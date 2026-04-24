import os
# CRITICAL: This must be set before other imports to handle Google's scope expansion
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import datetime
import dotenv

# Load environment variables
dotenv.load_dotenv()

from models import db, User, ArchivalLedger

# Point static_folder to the frontend build directory
app = Flask(__name__, 
            static_folder='../frontend/dist',
            static_url_path='/')

# --- DATABASE CONFIG ---
# 1. Get raw URL and handle None/Empty/Quotes
raw_db_url = os.getenv('DATABASE_URL', '').strip().strip("'").strip('"')

# 2. Fallback to SQLite if empty (Safe for development)
if not raw_db_url:
    raw_db_url = 'sqlite:///drivesafe_fallback.db'
    print("⚠️ WARNING: DATABASE_URL not set. Falling back to local SQLite.", flush=True)

# 3. Protocol Cleanup & Driver Mapping
# Convert problematic protocols to our installed drivers
if raw_db_url.startswith("mariadb+mariadbconnector://"):
    raw_db_url = raw_db_url.replace("mariadb+mariadbconnector://", "mysql+pymysql://", 1)
elif raw_db_url.startswith("mariadb://"):
    raw_db_url = raw_db_url.replace("mariadb://", "mysql+pymysql://", 1)
elif raw_db_url.startswith("mysql://"):
    raw_db_url = raw_db_url.replace("mysql://", "mysql+pymysql://", 1)
elif raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

# 4. Debug Print (Masked Password)
try:
    if '@' in raw_db_url:
        protocol_part = raw_db_url.split('://')[0]
        host_part = raw_db_url.split('@')[-1]
        print(f"🚀 DATABASE_URI: {protocol_part}://****@{host_part}", flush=True)
    else:
        print(f"🚀 DATABASE_URI: {raw_db_url}", flush=True)
except Exception:
    print("🚀 DATABASE_URI: [Found but unparseable for logging]", flush=True)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'drivesafe-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = raw_db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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

# --- DATABASE INITIALIZATION ---
@app.before_request
def create_tables():
    # This is a safety check that runs once per process
    if not hasattr(app, '_db_initialized'):
        with app.app_context():
            db.create_all()
        app._db_initialized = True

# --- FRONTEND ROUTES ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# --- AUTH ROUTES ---
@app.route('/auth/google', methods=['POST'])
def google_auth():
    code = request.json.get('code')
    try:
        from google_auth_oauthlib.flow import Flow 
        import json
        secret_path = os.path.join(os.path.dirname(__file__), "client_secret.json")
        
        # Check if file exists; if not, try to create it from Env Var
        if not os.path.exists(secret_path):
            env_secret = os.getenv('GOOGLE_CLIENT_SECRET_JSON')
            if env_secret:
                with open(secret_path, 'w') as f:
                    # Validate it's proper JSON before writing
                    json.loads(env_secret) 
                    f.write(env_secret)
            else:
                return jsonify({"error": "client_secret.json not found on backend. Please set GOOGLE_CLIENT_SECRET_JSON environment variable."}), 400

        # We request scopes for Drive and Spreadsheets to allow the app to act as the user
        flow = Flow.from_client_secrets_file(
            secret_path, 
            scopes=[
                "openid", 
                "email", 
                "profile", 
                "https://www.googleapis.com/auth/drive",
                "https://www.googleapis.com/auth/spreadsheets",
                "https://spreadsheets.google.com/feeds"
            ], 
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
