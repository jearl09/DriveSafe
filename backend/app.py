from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import sqlite3
import datetime
import os
import io
import shutil
import zipfile  # We need this back
import ai_engine 

app = Flask(__name__)
CORS(app)

CLIENT_SECRETS_FILE = "client_secret.json"
DEFAULT_ARCHIVE_PATH = os.path.join(os.getcwd(), 'Capstone_Archives')

def get_archive_path():
    if os.path.exists("config_path.txt"):
        with open("config_path.txt", "r") as f:
            return f.read().strip()
    return DEFAULT_ARCHIVE_PATH

def init_db():
    conn = sqlite3.connect('drivesafe.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, name TEXT, created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS backups 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT, filename TEXT, 
                  date TEXT, file_count INTEGER, status TEXT, local_path TEXT)''')
    conn.commit()
    conn.close()

# --- 1. LIST FILES (Fast Preview) ---
@app.route('/drive/files', methods=['GET'])
def list_files():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({"error": "No token"}), 401
    
    try:
        token = auth_header.split(" ")[1]
        creds = Credentials(token)
        service = build('drive', 'v3', credentials=creds)
        
        results = service.files().list(
            pageSize=10, fields="files(id, name, mimeType, size)"
        ).execute()
        files = results.get('files', [])
        
        processed_files = []
        stats = {"Academic": 0, "Personal": 0, "Other": 0}

        for f in files:
            cat = ai_engine.quick_predict_category_by_name(f['name'])
            f['category'] = cat 
            if cat in stats: stats[cat] += 1
            else: stats["Other"] += 1
            processed_files.append(f)
            
        return jsonify({"files": processed_files, "ai_stats": stats})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 2. BACKUP & ZIP (The "Restore" Logic) ---
@app.route('/drive/backup', methods=['POST'])
def create_backup():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({"error": "No token"}), 401
    token = auth_header.split(" ")[1]

    try:
        creds = Credentials(token)
        service = build('drive', 'v3', credentials=creds)
        oauth = build('oauth2', 'v2', credentials=creds)
        user_email = oauth.userinfo().get().execute().get('email')

        BASE_PATH = get_archive_path()
        if not os.path.exists(BASE_PATH): os.makedirs(BASE_PATH)

        results = service.files().list(pageSize=10, fields="files(id, name, mimeType)").execute()
        files = results.get('files', [])

        if not files: return jsonify({"error": "No files found"}), 404

        # Prepare the Memory Zip
        memory_file = io.BytesIO()
        
        with zipfile.ZipFile(memory_file, 'w') as zf:
            for file in files:
                try:
                    if 'google-apps' in file['mimeType']: continue

                    # A. Download
                    request_drive = service.files().get_media(fileId=file['id'])
                    fh = io.BytesIO()
                    downloader = MediaIoBaseDownload(fh, request_drive)
                    done = False
                    while not done: _, done = downloader.next_chunk()

                    temp_path = os.path.join(BASE_PATH, "temp_" + file['name'])
                    with open(temp_path, "wb") as f:
                        f.write(fh.getbuffer())

                    # B. AI Scan
                    metadata = ai_engine.scan_file_content(temp_path)
                    
                    # C. Move to Repository (Physical Folder)
                    final_path = ai_engine.move_to_archive(temp_path, metadata, BASE_PATH)
                    
                    # D. Add to ZIP (Virtual Download)
                    # We name the file inside the zip: "Year/Project/File.pdf"
                    zip_name = f"{metadata['year']}/{metadata['title']}/{os.path.basename(final_path)}"
                    zf.write(final_path, arcname=zip_name)
                    
                    # E. Log to DB
                    folder_name = f"{metadata['year']} - {metadata['title']}"
                    conn = sqlite3.connect('drivesafe.db')
                    c = conn.cursor()
                    c.execute("SELECT id FROM backups WHERE local_path = ?", (final_path,))
                    if not c.fetchone():
                        c.execute("INSERT INTO backups (user_email, filename, date, file_count, status, local_path) VALUES (?, ?, ?, ?, ?, ?)",
                                  (user_email, folder_name, datetime.datetime.now().strftime("%Y-%m-%d"), 1, "Archived", final_path))
                        conn.commit()
                    conn.close()

                except Exception as e:
                    print(f"Skipped {file['name']}: {e}")

        # Finish Zipping
        memory_file.seek(0)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d")
        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'DriveSafe_Archive_{timestamp}.zip'
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 3. SERVE FILE (Open button) ---
@app.route('/api/open-file', methods=['GET'])
def open_file():
    path = request.args.get('path')
    if path and os.path.exists(path):
        return send_file(path, as_attachment=False)
    return jsonify({"error": "File not found"}), 404

# --- HISTORY (Keep this) ---
@app.route('/history', methods=['GET'])
def get_history():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify([])
    try:
        token = auth_header.split(" ")[1]
        creds = Credentials(token)
        service = build('oauth2', 'v2', credentials=creds)
        user_email = service.userinfo().get().execute().get('email')

        conn = sqlite3.connect('drivesafe.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM backups WHERE user_email = ? ORDER BY id DESC LIMIT 10", (user_email,))
        rows = c.fetchall()
        history = [dict(row) for row in rows]
        conn.close()
        return jsonify(history)
    except:
        return jsonify([])

# --- AUTH (Keep this) ---
@app.route('/auth/google', methods=['POST'])
def google_auth():
    code = request.json.get('code')
    try:
        from google_auth_oauthlib.flow import Flow 
        flow = Flow.from_client_secrets_file("client_secret.json", scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/drive.readonly"], redirect_uri='postmessage')
        flow.fetch_token(code=code)
        service = build('oauth2', 'v2', credentials=flow.credentials)
        user_info = service.userinfo().get().execute()
        return jsonify({
            "access_token": flow.credentials.token,
            "user_email": user_info['email'],
            "user_name": user_info['name']
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
        

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)