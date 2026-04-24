import os
import io
import re
import hashlib
import datetime
import logging
import pdfplumber
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from oauth2client.service_account import ServiceAccountCredentials
from models import db, ArchivalLedger

# AI Imports
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ArchivalEngine:
    def __init__(self, service_account_json_path=None, archive_root='Capstone_Archives', user_credentials=None):
        self.scope = ["https://www.googleapis.com/auth/drive"]
        
        if user_credentials:
            self.service = build('drive', 'v3', credentials=user_credentials)
        elif service_account_json_path:
            self.creds = ServiceAccountCredentials.from_json_keyfile_name(service_account_json_path, self.scope)
            self.service = build('drive', 'v3', credentials=self.creds)
        else:
             raise ValueError("No authentication method provided for ArchivalEngine")
             
        self.archive_root = archive_root

    def _extract_file_id(self, url):
        if not url: return None
        match = re.search(r'/d/([a-zA-Z0-9_-]{25,})', url)
        if match: return match.group(1)
        match = re.search(r'id=([a-zA-Z0-9_-]{25,})', url)
        if match: return match.group(1)
        return None

    def _compute_hash(self, file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _extract_text_from_pdf(self, file_path):
        try:
            text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages[:10]:
                    text += (page.extract_text() or "")
            return text
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return ""

    def check_for_duplicates(self, new_file_hash, new_text):
        """
        Deduplication Engine: Returns (type, score, original_title, original_project_id)
        """
        # 1. Exact Hash Check
        exact_match = ArchivalLedger.query.filter(
            (ArchivalLedger.srs_hash == new_file_hash) | 
            (ArchivalLedger.sdd_hash == new_file_hash)
        ).first()
        
        if exact_match:
            return "Exact Duplicate", 1.0, exact_match.project_title, exact_match.project_id

        # 2. AI Semantic Similarity
        if not new_text or len(new_text) < 200: 
            return None, 0, None, None

        past_records = ArchivalLedger.query.filter(ArchivalLedger.status == 'archived').all()
        for record in past_records:
            # Check SRS of past projects
            path = record.srs_local_path or record.sdd_local_path
            if path and os.path.exists(path):
                past_text = self._extract_text_from_pdf(path)
                if len(past_text) > 200:
                    try:
                        vectorizer = TfidfVectorizer().fit_transform([new_text, past_text])
                        vectors = vectorizer.toarray()
                        similarity = cosine_similarity(vectors)[0][1]
                        # 90% threshold for blocking
                        if similarity > 0.90:
                            return "Semantic Duplicate", similarity, record.project_title, record.project_id
                    except: continue
        return None, 0, None, None

    def download_file(self, file_id, destination_path):
        try:
            file_metadata = self.service.files().get(fileId=file_id, fields='mimeType, name, size').execute()
            mime_type = file_metadata.get('mimeType')
            file_name = file_metadata.get('name')
            logger.info(f"Attempting to download: {file_name} (Type: {mime_type})")

            fh = io.BytesIO()
            final_ext = ".pdf" # Default
            
            if 'google-apps.document' in mime_type:
                # Native Google Doc -> Export to PDF
                request = self.service.files().export_media(fileId=file_id, mimeType='application/pdf')
            elif 'google-apps.spreadsheet' in mime_type:
                # Native Google Sheet -> Export to PDF (Perfect for RI)
                request = self.service.files().export_media(fileId=file_id, mimeType='application/pdf')
            elif 'officedocument.spreadsheetml.sheet' in mime_type or 'ms-excel' in mime_type:
                # Raw Excel File -> Download as is
                request = self.service.files().get_media(fileId=file_id)
                final_ext = ".xlsx"
            elif 'officedocument.wordprocessingml.document' in mime_type:
                # Raw Word File -> Download as is
                request = self.service.files().get_media(fileId=file_id)
                final_ext = ".docx"
            else:
                request = self.service.files().get_media(fileId=file_id)
                if 'pdf' in mime_type: final_ext = ".pdf"
                else: final_ext = ".bin"

            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            content = fh.getvalue()
            if len(content) == 0:
                raise Exception("Downloaded file is empty.")

            # Update the destination path if the extension changed
            if not destination_path.endswith(final_ext):
                base = os.path.splitext(destination_path)[0]
                destination_path = base + final_ext

            with open(destination_path, 'wb') as f:
                f.write(content)
                
            logger.info(f"Downloaded {file_name} as {final_ext}, size: {len(content)} bytes")
            return destination_path # Return the actual path used
        except Exception as e:
            logger.error(f"Download Error for {file_id}: {e}")
            raise e

    def archive_project(self, project_data, workbook_name="Archives"):
        project_title = project_data.get('project_title', 'Untitled').replace(' ', '_').replace('/', '_')
        base_project_dir = os.path.join(self.archive_root, workbook_name, project_title)
        os.makedirs(base_project_dir, exist_ok=True)
        
        last_record = ArchivalLedger.query.filter_by(
            project_id=project_data.get('project_id'),
            academic_year=project_data.get('academic_year'),
            status='archived'
        ).order_by(ArchivalLedger.version.desc()).first()
        
        current_version = (last_record.version if last_record else 0) + 1
        
        doc_types = ['srs', 'sdd', 'spmp', 'std', 'ri']
        results = {dt: {'path': None, 'hash': None, 'dup': None, 'bin': None} for dt in doc_types}
        error_msg = ""
        is_duplicate = False

        for doc_type in doc_types:
            link = project_data.get(f'{doc_type}_link')
            file_id = self._extract_file_id(link)
            
            if file_id:
                try:
                    doc_dir = os.path.join(base_project_dir, doc_type.upper())
                    os.makedirs(doc_dir, exist_ok=True)

                    # Initial temp name (extension will be corrected by download_file)
                    temp_path = os.path.join(doc_dir, f"TEMP_{doc_type.upper()}.pdf")
                    actual_temp_path = self.download_file(file_id, temp_path)
                    ext = os.path.splitext(actual_temp_path)[1]
                    
                    with open(actual_temp_path, "rb") as f:
                        file_binary = f.read()
                        results[doc_type]['bin'] = file_binary
                    
                    file_hash = self._compute_hash(actual_temp_path)
                    
                    # Only do text extraction for PDFs (for AI similarity)
                    file_text = ""
                    if ext == ".pdf":
                        file_text = self._extract_text_from_pdf(actual_temp_path)
                    
                    dup_type, score, orig_title, orig_project_id = self.check_for_duplicates(file_hash, file_text)
                    
                    if dup_type == "Exact Duplicate":
                        if orig_project_id == project_data.get('project_id'):
                            is_duplicate = True
                            results[doc_type]['dup'] = f"Already archived"
                            os.remove(actual_temp_path)
                            continue
                        else:
                            is_duplicate = True
                            results[doc_type]['dup'] = f"Duplicate of {orig_title}"
                            os.remove(actual_temp_path)
                            continue

                    final_name = f"{project_title}_{doc_type.upper()}_v{current_version}{ext}"
                    final_path = os.path.join(doc_dir, final_name)
                    
                    v_safe = current_version
                    while os.path.exists(final_path):
                        v_safe += 1
                        final_path = os.path.join(doc_dir, f"{project_title}_{doc_type.upper()}_v{v_safe}{ext}")

                    os.rename(actual_temp_path, final_path)
                    rel_path = os.path.relpath(final_path, self.archive_root)
                    results[doc_type]['path'] = rel_path
                    results[doc_type]['hash'] = file_hash
                    
                except Exception as e:
                    error_msg += f"{doc_type.upper()} Error: {str(e)}; "

        status = "archived"
        if error_msg: status = "failed"
        elif is_duplicate: status = "duplicate"

        if status == "archived":
            ledger_entry = ArchivalLedger(
                project_id=project_data.get('project_id'),
                project_title=project_data.get('project_title'),
                academic_year=project_data.get('academic_year'),
                srs_original_url=project_data.get('srs_link'),
                sdd_original_url=project_data.get('sdd_link'),
                spmp_original_url=project_data.get('spmp_link'),
                std_original_url=project_data.get('std_link'),
                ri_original_url=project_data.get('ri_link'),
                srs_local_path=results['srs']['path'],
                sdd_local_path=results['sdd']['path'],
                spmp_local_path=results['spmp']['path'],
                std_local_path=results['std']['path'],
                ri_local_path=results['ri']['path'],
                srs_hash=results['srs']['hash'],
                sdd_hash=results['sdd']['hash'],
                spmp_hash=results['spmp']['hash'],
                std_hash=results['std']['hash'],
                ri_hash=results['ri']['hash'],
                srs_binary=results['srs']['bin'],
                sdd_binary=results['sdd']['bin'],
                spmp_binary=results['spmp']['bin'],
                std_binary=results['std']['bin'],
                ri_binary=results['ri']['bin'],
                status=status,
                version=current_version,
                error_message=error_msg.strip(),
                archived_at=datetime.datetime.utcnow()
            )
            db.session.add(ledger_entry)
            db.session.commit()
        
        return {
            'status': status, 
            'paths': {dt: results[dt]['path'] for dt in doc_types},
            'error': error_msg.strip()
        }
