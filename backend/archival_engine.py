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
            if 'google-apps.document' in mime_type:
                # Native Google Doc -> Export to PDF
                request = self.service.files().export_media(fileId=file_id, mimeType='application/pdf')
            elif 'officedocument.wordprocessingml.document' in mime_type:
                # It's a .docx file -> We should still try to export to PDF if possible, 
                # but export_media only works for Google-native files. 
                # For .docx, we download the raw file.
                request = self.service.files().get_media(fileId=file_id)
                # Change destination to .docx later or handle it. 
                # For now, let's just download it.
            else:
                request = self.service.files().get_media(fileId=file_id)

            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            content = fh.getvalue()
            if len(content) == 0:
                raise Exception("Downloaded file is empty.")

            with open(destination_path, 'wb') as f:
                f.write(content)
                
            logger.info(f"Downloaded {file_name}, size: {len(content)} bytes")
            return True
        except Exception as e:
            logger.error(f"Download Error for {file_id}: {e}")
            raise e

    def archive_project(self, project_data):
        academic_year = project_data.get('academic_year', 'Unknown_Year')
        project_title = project_data.get('project_title', 'Untitled').replace(' ', '_').replace('/', '_')
        project_dir = os.path.join(self.archive_root, academic_year, project_title)
        os.makedirs(project_dir, exist_ok=True)
        
        # Determine current version for this project in this academic year
        last_record = ArchivalLedger.query.filter_by(
            project_id=project_data.get('project_id'),
            academic_year=academic_year,
            status='archived'
        ).order_by(ArchivalLedger.version.desc()).first()
        
        current_version = (last_record.version if last_record else 0) + 1
        
        results = {'srs': {'path': None, 'hash': None, 'dup': None, 'bin': None}, 'sdd': {'path': None, 'hash': None, 'dup': None, 'bin': None}}
        error_msg = ""
        is_duplicate = False

        for doc_type in ['srs', 'sdd']:
            link = project_data.get(f'{doc_type}_link')
            file_id = self._extract_file_id(link)
            
            if file_id:
                try:
                    temp_path = os.path.join(project_dir, f"TEMP_{doc_type.upper()}.pdf")
                    self.download_file(file_id, temp_path)
                    
                    # Read the binary content for DB storage
                    with open(temp_path, "rb") as f:
                        file_binary = f.read()
                        results[doc_type]['bin'] = file_binary
                    
                    file_hash = self._compute_hash(temp_path)
                    file_text = self._extract_text_from_pdf(temp_path)
                    
                    # BLOCK DUPLICATES
                    dup_type, score, orig_title, orig_project_id = self.check_for_duplicates(file_hash, file_text)
                    
                    if dup_type == "Exact Duplicate":
                        # If it's the SAME project, it's just an already archived version
                        if orig_project_id == project_data.get('project_id'):
                            is_duplicate = True
                            results[doc_type]['dup'] = f"Already archived"
                            os.remove(temp_path)
                            continue
                        else:
                            # It's an exact copy of a DIFFERENT project (Plagiarism!)
                            is_duplicate = True
                            results[doc_type]['dup'] = f"Duplicate of {orig_title} blocked."
                            os.remove(temp_path)
                            continue

                    if dup_type == "Semantic Duplicate" and score > 0.95:
                        if orig_project_id != project_data.get('project_id'):
                            # Plagiarism detection for other projects
                            is_duplicate = True
                            results[doc_type]['dup'] = f"High similarity with {orig_title} ({int(score*100)}%)"
                            os.remove(temp_path)
                            continue
                        # If it's the same project, we allow it (it's a revision)

                    # Save as a new version file
                    final_name = f"{project_title}_{doc_type.upper()}_v{current_version}.pdf"
                    final_path = os.path.join(project_dir, final_name)
                    
                    # Ensure we don't overwrite if file exists (safety check)
                    v_safe = current_version
                    while os.path.exists(final_path):
                        v_safe += 1
                        final_path = os.path.join(project_dir, f"{project_title}_{doc_type.upper()}_v{v_safe}.pdf")

                    os.rename(temp_path, final_path)
                    results[doc_type]['path'] = final_path
                    results[doc_type]['hash'] = file_hash
                except Exception as e:
                    error_msg += f"{doc_type.upper()} Error: {str(e)}; "

        status = "archived"
        if error_msg: status = "failed"
        elif is_duplicate: status = "duplicate"

        # Combine duplicate warnings into error field for sheet feedback
        if is_duplicate:
            error_msg += (results['srs']['dup'] or "") + " " + (results['sdd']['dup'] or "")

        # ONLY save to MariaDB if we actually archived something new
        if status == "archived":
            ledger_entry = ArchivalLedger(
                project_id=project_data.get('project_id'),
                project_title=project_data.get('project_title'),
                academic_year=academic_year,
                srs_original_url=project_data.get('srs_link'),
                sdd_original_url=project_data.get('sdd_link'),
                srs_local_path=results['srs']['path'],
                sdd_local_path=results['sdd']['path'],
                srs_hash=results['srs']['hash'],
                sdd_hash=results['sdd']['hash'],
                srs_binary=results['srs']['bin'],
                sdd_binary=results['sdd']['bin'],
                status=status,
                version=current_version,
                error_message=error_msg.strip(),
                archived_at=datetime.datetime.utcnow()
            )
            db.session.add(ledger_entry)
            db.session.commit()
        
        return {
            'status': status, 
            'srs_path': results['srs']['path'], 
            'sdd_path': results['sdd']['path'], 
            'error': error_msg.strip()
        }
