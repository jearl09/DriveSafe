from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
import os
import requests
import threading
from registry_sheets import RegistrySheetsService
from archival_engine import ArchivalEngine

registry_bp = Blueprint('registry', __name__)

from google.oauth2.credentials import Credentials
from flask import session

def get_user_creds():
    token = session.get('access_token')
    if not token:
        return None
    # We create a Credentials object from the token. 
    # Note: For long-running apps, you'd want refresh_token, client_id, and client_secret too.
    return Credentials(token)

def get_services(requested_sheet_id=None, provided_user_creds=None):
    # If creds are provided (from a thread), use them. Otherwise, try to get from session.
    user_creds = provided_user_creds or get_user_creds()
    service_account_path = os.getenv('SERVICE_ACCOUNT_JSON')
    
    # Priority for Sheet ID: 1. Argument, 2. JSON Body, 3. Query Param, 4. Env Var
    sheet_id = requested_sheet_id
    if not sheet_id and request: # Check if request context exists
        try:
            if request.is_json:
                sheet_id = request.json.get('sheet_id')
            if not sheet_id:
                sheet_id = request.args.get('sheet_id')
        except RuntimeError:
            pass # Outside request context
            
    if not sheet_id:
        sheet_id = os.getenv('SHEET_ID')
        
    archive_root = os.getenv('ARCHIVE_ROOT', 'Capstone_Archives')
    
    # Use User Creds if available, else Service Account
    sheets_service = RegistrySheetsService(
        service_account_json_path=service_account_path if not user_creds else None, 
        sheet_id=sheet_id,
        user_credentials=user_creds
    )
    
    engine = ArchivalEngine(
        service_account_json_path=service_account_path if not user_creds else None, 
        archive_root=archive_root,
        user_credentials=user_creds
    )
    return sheets_service, engine

@registry_bp.route('/api/registry/list-sheets', methods=['GET'])
@login_required
def list_sheets():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    try:
        user_creds = get_user_creds()
        service_account_path = os.getenv('SERVICE_ACCOUNT_JSON')
        
        sheets_service = RegistrySheetsService(
            service_account_json_path=service_account_path if not user_creds else None,
            user_credentials=user_creds
        )
        sheets = sheets_service.list_available_sheets()
        return jsonify(sheets)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@registry_bp.route('/api/registry/years', methods=['GET'])
@login_required
def get_years():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    try:
        sheets_service, _ = get_services()
        if not sheets_service.workbook:
             return jsonify({"error": "No Google Sheet selected or found"}), 400
        years = sheets_service.get_all_sheet_names()
        return jsonify(years)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@registry_bp.route('/api/registry/projects', methods=['GET'])
@login_required
def get_pending():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    year = request.args.get('year')
    if not year:
        return jsonify({"error": "Year (sheet name) is required"}), 400
        
    try:
        from models import ArchivalLedger
        sheets_service, _ = get_services()
        projects = sheets_service.get_all_projects(year)
        
        # Add latest version info from DB
        for p in projects:
            last_record = ArchivalLedger.query.filter_by(
                project_id=p['project_id'],
                academic_year=year,
                status='archived'
            ).order_by(ArchivalLedger.version.desc()).first()
            
            p['latest_version'] = last_record.version if last_record else 0
            
        return jsonify(projects)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@registry_bp.route('/api/registry/validate', methods=['POST'])
@login_required
def validate_links():
    """Pings Drive URLs to check if they are publicly accessible or accessible by service account"""
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
        
    links = request.json.get('links', [])
    results = {}
    
    for link in links:
        if not link: 
            results[link] = "Empty"
            continue
        try:
            # We just do a HEAD request or GET with small range to check accessibility
            # Note: Private drive files might return 403 even if service account has access
            # So this is a basic "is the URL valid" check.
            resp = requests.get(link, timeout=5, stream=True)
            if resp.status_code == 200:
                results[link] = "Accessible"
            else:
                results[link] = f"Error {resp.status_code}"
        except Exception as e:
            results[link] = f"Failed: {str(e)}"
            
    return jsonify(results)

@registry_bp.route('/api/registry/archive', methods=['POST'])
@login_required
def archive_selected():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
        
    projects = request.json.get('projects', [])
    if not projects:
        return jsonify({"error": "No projects selected"}), 400
    
    # Capture credentials and sheet_id WHILE in the request context
    user_creds = get_user_creds()
    sheet_id = request.json.get('sheet_id') or request.args.get('sheet_id') or os.getenv('SHEET_ID')
    
    # Get the actual app object to pass into the thread
    app = current_app._get_current_object()
    
    def process_task(app_context, project_list, creds, sid):
        with app_context.app_context():
            # Pass sid and creds explicitly to get_services
            sheets_service, engine = get_services(requested_sheet_id=sid, provided_user_creds=creds)
            for p in project_list:
                try:
                    # Update status in Sheet to 'Processing'
                    sheets_service.update_status(p['academic_year'], p['row_index'], 'Processing')
                    
                    # Run archival engine
                    result = engine.archive_project(p)

                    # Update Sheet with final results
                    sheets_service.update_status(
                        p['academic_year'], 
                        p['row_index'], 
                        result['status'].capitalize(),
                        srs_path=result['srs_path'] or '',
                        sdd_path=result['sdd_path'] or '',
                        error_msg=result['error']
                    )

                except Exception as e:
                    print(f"Failed to process {p.get('project_title')}: {e}")
                    # Re-get services if session expired or similar? 
                    # For now just use the existing service.
                    try:
                        sheets_service.update_status(p['academic_year'], p['row_index'], 'Failed', error_msg=str(e))
                    except: pass

    thread = threading.Thread(target=process_task, args=(app, projects, user_creds, sheet_id))
    thread.start()
    
    return jsonify({"message": f"Started archival for {len(projects)} projects in background."}), 202

@registry_bp.route('/api/registry/download/<int:ledger_id>/<doc_type>', methods=['GET'])
@login_required
def download_from_db(ledger_id, doc_type):
    from models import ArchivalLedger
    from flask import send_file
    import io

    record = ArchivalLedger.query.get_or_404(ledger_id)
    preview = request.args.get('preview') == '1'
    
    binary_data = None
    if doc_type == 'srs':
        binary_data = record.srs_binary
    elif doc_type == 'sdd':
        binary_data = record.sdd_binary
    
    if not binary_data:
        return jsonify({"error": "File not found in database"}), 404

    # Create a safe filename
    clean_title = record.project_title.replace(' ', '_').replace('/', '_')
    filename = f"{clean_title}_{doc_type.upper()}_v{record.version}.pdf"

    return send_file(
        io.BytesIO(binary_data),
        mimetype='application/pdf',
        as_attachment=not preview,
        download_name=filename
    )

@registry_bp.route('/api/registry/reset', methods=['POST'])
@login_required
def reset_project_status():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
        
    project = request.json.get('project')
    if not project:
        return jsonify({"error": "No project provided"}), 400
        
    try:
        sheets_service, _ = get_services()
        # Reset status to 'Pending' and clear the local paths in the sheet
        sheets_service.update_status(
            project['academic_year'], 
            project['row_index'], 
            'Pending', 
            srs_path='', 
            sdd_path='', 
            error_msg=''
        )
        return jsonify({"message": "Project status reset to Pending successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@registry_bp.route('/api/registry/ledger', methods=['GET'])
@login_required
def get_ledger():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    from models import ArchivalLedger
    from sqlalchemy.orm import defer
    
    # We use defer() to skip the heavy binary columns during listing. 
    # This makes the API much faster.
    records = ArchivalLedger.query.options(
        defer(ArchivalLedger.srs_binary), 
        defer(ArchivalLedger.sdd_binary)
    ).order_by(ArchivalLedger.id.desc()).all()
    
    return jsonify([{
        "id": r.id,
        "project_id": r.project_id,
        "project_title": r.project_title,
        "academic_year": r.academic_year,
        "status": r.status,
        "version": r.version,
        "srs_path": r.srs_local_path,
        "sdd_path": r.sdd_local_path,
        "srs_hash": r.srs_hash,
        "sdd_hash": r.sdd_hash,
        "error": r.error_message,
        "archived_at": r.archived_at.strftime("%Y-%m-%d %H:%M:%S") if r.archived_at else None
    } for r in records])

@registry_bp.route('/api/registry/stats', methods=['GET'])
@login_required
def get_stats():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    from models import ArchivalLedger
    import os
    import datetime
    
    # 1. Total Archived Count (from MariaDB)
    archived_count = ArchivalLedger.query.filter_by(status='archived').count()
    
    # 2. Pending Count (from active Google Sheet)
    pending_count = 0
    service_account_ok = False
    try:
        sheets_service, engine = get_services()
        years = sheets_service.get_all_sheet_names()
        if years:
            active_year = years[0] 
            all_projects = sheets_service.get_all_projects(active_year)
            pending_count = len([p for p in all_projects if p['status'].lower() == 'pending'])
        service_account_ok = True
    except Exception as e:
        print(f"Stats Error (GSheets): {e}")

    return jsonify({
        "archived_count": archived_count,
        "pending_count": pending_count,
        "service_account_configured": service_account_ok and os.path.exists(os.getenv('SERVICE_ACCOUNT_JSON', '')),
        "last_sync": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
