from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
import os
import requests
import threading
from registry_sheets import RegistrySheetsService
from archival_engine import ArchivalEngine

registry_bp = Blueprint('registry', __name__)

def get_services():
    service_account_path = os.getenv('SERVICE_ACCOUNT_JSON')
    sheet_id = os.getenv('SHEET_ID')
    archive_root = os.getenv('ARCHIVE_ROOT', 'Capstone_Archives')
    
    sheets_service = RegistrySheetsService(service_account_path, sheet_id)
    engine = ArchivalEngine(service_account_path, archive_root)
    return sheets_service, engine

@registry_bp.route('/api/registry/years', methods=['GET'])
@login_required
def get_years():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    try:
        sheets_service, _ = get_services()
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
        sheets_service, _ = get_services()
        projects = sheets_service.get_pending_projects(year)
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
        
    # Get the actual app object to pass into the thread
    app = current_app._get_current_object()
    
    def process_task(app_context, project_list):
        with app_context.app_context():
            sheets_service, engine = get_services()
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
                    sheets_service.update_status(p['academic_year'], p['row_index'], 'Failed', error_msg=str(e))

    thread = threading.Thread(target=process_task, args=(app, projects,))
    thread.start()
    
    return jsonify({"message": f"Started archival for {len(projects)} projects in background."}), 202

@registry_bp.route('/api/registry/ledger', methods=['GET'])
@login_required
def get_ledger():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    from models import ArchivalLedger
    records = ArchivalLedger.query.order_by(ArchivalLedger.id.desc()).all()
    
    return jsonify([{
        "id": r.id,
        "project_id": r.project_id,
        "project_title": r.project_title,
        "academic_year": r.academic_year,
        "status": r.status,
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
            pending = sheets_service.get_pending_projects(active_year)
            pending_count = len(pending)
        service_account_ok = True
    except Exception as e:
        print(f"Stats Error (GSheets): {e}")

    return jsonify({
        "archived_count": archived_count,
        "pending_count": pending_count,
        "service_account_configured": service_account_ok and os.path.exists(os.getenv('SERVICE_ACCOUNT_JSON', '')),
        "last_sync": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
