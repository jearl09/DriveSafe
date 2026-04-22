import os
import io
import re
import hashlib
import datetime
import logging
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from oauth2client.service_account import ServiceAccountCredentials
from models import db, ArchivalLedger

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ArchivalEngine:
    def __init__(self, service_account_json_path, archive_root):
        self.scope = ["https://www.googleapis.com/auth/drive"]
        self.creds = ServiceAccountCredentials.from_json_keyfile_name(service_account_json_path, self.scope)
        self.service = build('drive', 'v3', credentials=self.creds)
        self.archive_root = archive_root

    def _extract_file_id(self, url):
        """Extracts Google Drive file ID from common URL formats"""
        if not url:
            return None
        
        # Pattern for /file/d/ID/view
        match = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)
        
        # Pattern for ?id=ID
        match = re.search(r'id=([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)
            
        return None

    def _get_next_version(self, folder_path, base_filename, suffix):
        """Finds the next available version number for a file"""
        # base_filename: "My Project SRS"
        # suffix: "_v"
        # Expected: "My Project SRS_v1.pdf", "My Project SRS_v2.pdf", etc.
        
        version = 1
        while True:
            file_name = f"{base_filename}{suffix}{version}.pdf"
            if not os.path.exists(os.path.join(folder_path, file_name)):
                return file_name, version
            version += 1

    def _compute_hash(self, file_path):
        """Computes SHA-256 hash of a file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def download_file(self, file_id, destination_path):
        """Downloads a file from Google Drive using ID"""
        try:
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
                logger.info(f"Download {int(status.progress() * 100)}%")
            
            with open(destination_path, 'wb') as f:
                f.write(fh.getbuffer())
            return True
        except Exception as e:
            logger.error(f"Error downloading file {file_id}: {e}")
            raise e

    def archive_project(self, project_data):
        """
        Processes a single project row: download SRS/SDS, save locally, hash, log to DB.
        project_data: {row_index, project_id, project_title, srs_link, sds_link, academic_year}
        """
        academic_year = project_data.get('academic_year', 'Unknown_Year')
        project_title = project_data.get('project_title', 'Untitled').replace(' ', '_').replace('/', '_')
        
        # 1. Create directory structure: Capstone_Archives/{academic_year}/{project_title}
        project_dir = os.path.join(self.archive_root, academic_year, project_title)
        os.makedirs(project_dir, exist_ok=True)
        
        srs_local_path = None
        sds_local_path = None
        srs_hash = None
        sds_hash = None
        error_msg = ""
        
        # 2. Process SRS
        srs_id = self._extract_file_id(project_data.get('srs_link'))
        if srs_id:
            try:
                fname, _ = self._get_next_version(project_dir, f"{project_title}_SRS", "_v")
                dest = os.path.join(project_dir, fname)
                self.download_file(srs_id, dest)
                srs_local_path = dest
                srs_hash = self._compute_hash(dest)
            except Exception as e:
                error_msg += f"SRS Download Failed: {str(e)}; "

        # 3. Process SDS
        sds_id = self._extract_file_id(project_data.get('sds_link'))
        if sds_id:
            try:
                fname, _ = self._get_next_version(project_dir, f"{project_title}_SDS", "_v")
                dest = os.path.join(project_dir, fname)
                self.download_file(sds_id, dest)
                sds_local_path = dest
                sds_hash = self._compute_hash(dest)
            except Exception as e:
                error_msg += f"SDS Download Failed: {str(e)}; "

        status = "archived" if not error_msg and (srs_local_path or sds_local_path) else "failed"
        if not srs_id and not sds_id:
            status = "failed"
            error_msg = "No valid links found."

        # 4. Log to MariaDB ArchivalLedger
        ledger_entry = ArchivalLedger(
            project_id=project_data.get('project_id'),
            project_title=project_data.get('project_title'),
            academic_year=academic_year,
            srs_original_url=project_data.get('srs_link'),
            sds_original_url=project_data.get('sds_link'),
            srs_local_path=srs_local_path,
            sds_local_path=sds_local_path,
            srs_hash=srs_hash,
            sds_hash=sds_hash,
            status=status,
            error_message=error_msg.strip(),
            archived_at=datetime.datetime.utcnow() if status == "archived" else None
        )
        db.session.add(ledger_entry)
        db.session.commit()
        
        return {
            'status': status,
            'srs_path': srs_local_path,
            'sds_path': sds_local_path,
            'error': error_msg.strip(),
            'ledger_id': ledger_entry.id
        }
