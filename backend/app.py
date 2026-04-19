from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import datetime
import os
import io
import shutil
import zipfile
import ai_engine 
from models import db, User, UploadedProject, Backup

app = Flask(__name__, instance_relative_config=True)
app.config['SECRET_KEY'] = 'drivesafe-secret-key'
# Ensure we use the database in the instance folder
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///drivesafe.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True

db.init_app(app)
login_manager = LoginManager(app)
CORS(app, supports_credentials=True)

@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors
    if hasattr(e, 'code'):
        return jsonify({"error": str(e)}), e.code
    # Handle non-HTTP errors
    print(f"CRITICAL ERROR: {str(e)}")
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized. Please log in first."}), 401

# Import Blueprints AFTER db.init_app to avoid circular issues
from upload_routes import upload_bp
from review_routes import review_bp
from teacher_routes import teacher_bp
app.register_blueprint(upload_bp)
app.register_blueprint(review_bp)
app.register_blueprint(teacher_bp)

# --- ROUTES ---
@app.route('/auth/google', methods=['POST'])
def google_auth():
    code = request.json.get('code')
    try:
        from google_auth_oauthlib.flow import Flow 
        secret_path = os.path.join(os.path.dirname(__file__), "client_secret.json")
        flow = Flow.from_client_secrets_file(
            secret_path, 
            scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/drive.readonly"], 
            redirect_uri='postmessage'
        )
        flow.fetch_token(code=code)
        service = build('oauth2', 'v2', credentials=flow.credentials)
        user_info = service.userinfo().get().execute()
        
        user = User.query.filter_by(email=user_info['email']).first()
        if not user:
            # AUTO-ROLE LOGIC
            role = 'student'
            # 1. Any email in this list is a teacher
            # 2. Any email containing 'faculty' or 'admin' is a teacher
            teacher_identifiers = ['faculty', 'admin', 'johnearlmandawe17@gmail.com', 'johnearl.mandawe@cit.edu.ph']
            if any(id in user_info['email'].lower() for id in teacher_identifiers):
                role = 'teacher'
            
            user = User(email=user_info['email'], name=user_info['name'], role=role)
            db.session.add(user)
            db.session.commit()
            
        login_user(user)
        session['access_token'] = flow.credentials.token
        
        return jsonify({
            "access_token": flow.credentials.token,
            "user_email": user.email,
            "user_name": user.name,
            "role": user.role
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/user-info', methods=['GET'])
@login_required
def get_user_info():
    return jsonify({
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role
    })

# --- DRIVE LOGIC ---
@app.route('/drive/files', methods=['GET'])
@login_required
def list_files():
    token = session.get('access_token')
    if not token: return jsonify({"error": "No drive token"}), 401
    
    try:
        creds = Credentials(token)
        service = build('drive', 'v3', credentials=creds)
        results = service.files().list(pageSize=10, fields="files(id, name, mimeType, size)").execute()
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

@app.route('/history', methods=['GET'])
@login_required
def get_history():
    history = Backup.query.filter_by(user_email=current_user.email).order_by(Backup.id.desc()).limit(10).all()
    return jsonify([{
        "id": h.id, "filename": h.filename, "date": h.date, 
        "file_count": h.file_count, "status": h.status, "local_path": h.local_path
    } for h in history])

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
