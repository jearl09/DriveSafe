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
    """
    Extracts the file ID from various Google Drive link formats.
    """
    if not url: return None
    # Format 1: /d/ID/view
    # Format 2: id=ID
    match = re.search(r'/d/([^/]+)', url)
    if match: return match.group(1)
    match = re.search(r'id=([^&]+)', url)
    if match: return match.group(1)
    return None

def run_archival_on_links(project):
    """
    Downloads files from links (handling Google Drive IDs) and archives them.
    """
    project_title = project.project_name.replace(" ", "_").upper()
    year = "2025-2026"
    
    project_folder = f"{year}_{project_title}"
    dest_dir = os.path.join(DEFAULT_ARCHIVE_PATH, project_folder)
    os.makedirs(dest_dir, exist_ok=True)
    
    links = {
        "SRS": project.srs_link,
        "SDD": project.sdd_link
    }
    
    # Get the Google Drive Service using the current user's token
    token = session.get('access_token')
    service = None
    if token:
        creds = Credentials(token)
        service = build('drive', 'v3', credentials=creds)

    archive_paths = []
    
    for doc_type, url in links.items():
        if not url or url == "": continue
        
        local_file_path = os.path.join(dest_dir, f"{doc_type}_{project_title}.pdf")
        drive_id = extract_google_drive_id(url)
        
        try:
            if drive_id and service:
                # OPTION A: Use Google Drive API (Best for Drive Links)
                print(f"Downloading {doc_type} via Drive API (ID: {drive_id})...")
                request_drive = service.files().get_media(fileId=drive_id)
                fh = io.BytesIO()
                downloader = MediaIoBaseDownload(fh, request_drive)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                
                with open(local_file_path, 'wb') as f:
                    f.write(fh.getbuffer())
            else:
                # OPTION B: Simple Download (For direct public PDF links)
                print(f"Downloading {doc_type} via Direct Request...")
                response = requests.get(url, timeout=15)
                if response.status_code == 200:
                    with open(local_file_path, 'wb') as f:
                        f.write(response.content)
                else:
                    raise Exception(f"Failed to download (Status: {response.status_code})")
            
            # Register in History
            from flask_login import current_user
            new_backup = Backup(
                user_email=current_user.email,
                filename=f"{project.project_name} ({doc_type})",
                date=datetime.datetime.now().strftime("%Y-%m-%d"),
                file_count=1,
                status="Archived",
                local_path=local_file_path
            )
            db.session.add(new_backup)
            archive_paths.append(local_file_path)
            
        except Exception as e:
            print(f"Archival failed for {doc_type}: {e}")
            raise Exception(f"Could not download {doc_type}. Error: {str(e)}")

    db.session.commit()
    return dest_dir
