import os
# CRITICAL: This must be set before other imports to handle Google's scope expansion
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import datetime
import dotenv

# Load environment variables
dotenv.load_dotenv()

from models import db, User, ArchivalLedger, Backup

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'drivesafe-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://root:123Earl.@localhost/drivesafe_prod')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True

db.init_app(app)
login_manager = LoginManager(app)
CORS(app, supports_credentials=True)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized. Please log in first."}), 401

# Register Registry Blueprint
from registry_routes import registry_bp
app.register_blueprint(registry_bp)

# --- AUTH ROUTES ---
@app.route('/auth/google', methods=['POST'])
def google_auth():
    code = request.json.get('code')
    try:
        from google_auth_oauthlib.flow import Flow 
        secret_path = os.path.join(os.path.dirname(__file__), "client_secret.json")
        
        if not os.path.exists(secret_path):
            return jsonify({"error": "client_secret.json not found on backend."}), 400

        # We request minimal scopes. OAUTHLIB_RELAX_TOKEN_SCOPE handles any extras Google sends back.
        flow = Flow.from_client_secrets_file(
            secret_path, 
            scopes=["openid", "email", "profile"], 
            redirect_uri='postmessage'
        )
        flow.fetch_token(code=code)
        service = build('oauth2', 'v2', credentials=flow.credentials)
        user_info = service.userinfo().get().execute()
        
        user = User.query.filter_by(email=user_info['email']).first()
        if not user:
            role = 'teacher' 
            user = User(email=user_info['email'], name=user_info['name'], role=role)
            db.session.add(user)
            db.session.commit()
            
        login_user(user)
        session['access_token'] = flow.credentials.token
        
        return jsonify({
            "user_email": user.email,
            "user_name": user.name,
            "role": user.role
        }), 200
    except Exception as e:
        # If it still fails, it's likely a mismatch in the 'scopes' list above vs what was sent
        print(f"AUTH ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route('/api/user-info', methods=['GET'])
@login_required
def get_user_info():
    return jsonify({
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role
    })

@app.route('/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200

@app.route('/history', methods=['GET'])
@login_required
def get_history():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    history = Backup.query.order_by(Backup.id.desc()).limit(20).all()
    return jsonify([{
        "id": h.id, "filename": h.filename, "date": h.date, 
        "file_count": h.file_count, "status": h.status, "local_path": h.local_path
    } for h in history])

import traceback

@app.errorhandler(Exception)
def handle_exception(e):
    print("--- INTERNAL SERVER ERROR ---")
    traceback.print_exc()
    return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
