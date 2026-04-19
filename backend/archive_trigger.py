import os
import requests
import datetime
import io
import re
import ai_engine
from flask import session
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from models import db, Backup, DEFAULT_ARCHIVE_PATH

def extract_google_drive_id(url):
    if not url: return None
    match = re.search(r'/d/([^/]+)', url)
    if match: return match.group(1)
    match = re.search(r'id=([^&]+)', url)
    if match: return match.group(1)
    return None

def run_archival_on_links(project):
    """
    Downloads files and organizes them into a YEAR-BASED CAPSTONE folder.
    """
    project_title = project.project_name.replace(" ", "_").upper()
    acad_year = project.academic_year or "2025-2026"
    
    # NEW: Organize into a Parent Year folder
    parent_folder_name = f"{acad_year} CAPSTONE PROJECTS"
    parent_dir = os.path.join(DEFAULT_ARCHIVE_PATH, parent_folder_name)
    
    # Project-specific subfolder
    project_dir = os.path.join(parent_dir, project_title)
    os.makedirs(project_dir, exist_ok=True)
    
    links = {
        "SRS": project.srs_link,
        "SDD": project.sdd_link
    }
    
    token = session.get('access_token')
    service = None
    if token:
        creds = Credentials(token)
        service = build('drive', 'v3', credentials=creds)

    for doc_type, url in links.items():
        if not url or url == "": continue
        
        local_file_path = os.path.join(project_dir, f"{doc_type}_{project_title}.pdf")
        drive_id = extract_google_drive_id(url)
        
        try:
            if drive_id and service:
                request_drive = service.files().get_media(fileId=drive_id)
                fh = io.BytesIO()
                downloader = MediaIoBaseDownload(fh, request_drive)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                with open(local_file_path, 'wb') as f:
                    f.write(fh.getbuffer())
            else:
                response = requests.get(url, timeout=15)
                if response.status_code == 200:
                    with open(local_file_path, 'wb') as f:
                        f.write(response.content)
            
            # SAVING TO DATABASE (Backup Table)
            from flask_login import current_user
            new_record = Backup(
                user_email=current_user.email,
                filename=f"{project.project_name} ({doc_type})",
                date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                file_count=1,
                status="Archived",
                local_path=local_file_path
            )
            db.session.add(new_record)
            
        except Exception as e:
            print(f"Archival failed for {doc_type}: {e}")
            raise Exception(f"Could not download {doc_type}. Error: {str(e)}")

    db.session.commit()
    return project_dir
