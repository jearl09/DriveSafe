from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
import os
import requests
import threading
from registry_sheets import RegistrySheetsService
from archival_engine import ArchivalEngine
from models import db

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
    
    # Get workbook name for folder structure
    try:
        sheets_service, _ = get_services(requested_sheet_id=sheet_id, provided_user_creds=user_creds)
        workbook_name = sheets_service.get_workbook_name()
    except:
        workbook_name = "Archives"

    # Get the actual app object to pass into the thread
    app = current_app._get_current_object()
    
    def process_task(app_context, project_list, creds, sid, wb_name):
        with app_context.app_context():
            # Pass sid and creds explicitly to get_services
            sheets_service, engine = get_services(requested_sheet_id=sid, provided_user_creds=creds)
            for p in project_list:
                try:
                    # Update status in Sheet to 'Processing'
                    sheets_service.update_status(p['academic_year'], p['row_index'], 'Processing')
                    
                    # Run archival engine
                    result = engine.archive_project(p, workbook_name=wb_name)

                    # Update Sheet with final results
                    status = result['status'].capitalize()
                    if result['status'] == 'unchanged':
                        status = 'Archived' # Keep as Archived in sheet even if no new version was created
                    
                    paths = result.get('paths', {})
                    # We pass None for missing paths to keep the sheet's current values
                    sheets_service.update_status(
                        p['academic_year'], 
                        p['row_index'], 
                        status,
                        srs_path=paths.get('srs') if paths.get('srs') else None,
                        sdd_path=paths.get('sdd') if paths.get('sdd') else None,
                        spmp_path=paths.get('spmp') if paths.get('spmp') else None,
                        std_path=paths.get('std') if paths.get('std') else None,
                        ri_path=paths.get('ri') if paths.get('ri') else None,
                        error_msg=result.get('error') if result.get('error') else None
                    )

                except Exception as e:
                    print(f"Failed to process {p.get('project_title')}: {e}")
                    try:
                        sheets_service.update_status(p['academic_year'], p['row_index'], 'Failed', error_msg=str(e))
                    except: pass

    thread = threading.Thread(target=process_task, args=(app, projects, user_creds, sheet_id, workbook_name))
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
    
    path_field = f"{doc_type}_local_path"
    binary_field = f"{doc_type}_binary"
    hash_field = f"{doc_type}_hash"
    
    binary_data = getattr(record, binary_field, None)
    file_path = getattr(record, path_field, '')
    target_hash = getattr(record, hash_field, None)
    
    # DEDUPLICATION LOGIC: 
    # If this version has no binary data (to save space), look back for a 
    # record of the SAME project that DOES have the binary data for this hash.
    if not binary_data and target_hash:
        source_record = ArchivalLedger.query.filter(
            ArchivalLedger.project_id == record.project_id,
            getattr(ArchivalLedger, hash_field) == target_hash,
            getattr(ArchivalLedger, binary_field).isnot(None)
        ).order_by(ArchivalLedger.id.asc()).first()
        
        if source_record:
            binary_data = getattr(source_record, binary_field)
            logger.info(f"Deduplication: Serving {doc_type.upper()} for {record.project_title} v{record.version} from v{source_record.version} storage.")

    if not binary_data:
        return jsonify({"error": f"{doc_type.upper()} file not found in database or history"}), 404

    # Get extension from the saved path
    ext = os.path.splitext(file_path)[1] if file_path else ".pdf"
    
    # Create a safe filename
    clean_title = record.project_title.replace(' ', '_').replace('/', '_')
    filename = f"{clean_title}_{doc_type.upper()}_v{record.version}{ext}"

    # For previews, force .pdf extension
    if preview:
        return send_file(
            io.BytesIO(binary_data),
            mimetype='application/pdf',
            as_attachment=False,
            download_name=filename,
            max_age=0
        )

    return send_file(
        io.BytesIO(binary_data),
        mimetype='application/pdf',
        as_attachment=True,
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
        # Reset status to 'Pending' and clear ALL local paths in the sheet
        sheets_service.update_status(
            project['academic_year'], 
            project['row_index'], 
            'Pending', 
            srs_path='', 
            sdd_path='', 
            spmp_path='',
            std_path='',
            ri_path='',
            error_msg=''
        )
        return jsonify({"message": "Project status reset to Pending successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@registry_bp.route('/api/registry/ledger/grouped', methods=['GET'])
@login_required
def get_grouped_ledger():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        from models import ArchivalLedger
        from sqlalchemy.orm import defer
        from collections import defaultdict

        academic_year = request.args.get('year')
        query = ArchivalLedger.query.options(
            defer(ArchivalLedger.srs_binary), 
            defer(ArchivalLedger.sdd_binary),
            defer(ArchivalLedger.spmp_binary),
            defer(ArchivalLedger.std_binary),
            defer(ArchivalLedger.ri_binary)
        )

        if academic_year:
            query = query.filter_by(academic_year=academic_year)
        
        # Process history chronologically (ASC) to calculate versions correctly
        records = query.order_by(ArchivalLedger.id.asc()).all()
        
        if not records:
            return jsonify([])

        # Track state for per-document versions
        last_hashes = defaultdict(lambda: defaultdict(lambda: None))
        doc_versions = defaultdict(lambda: defaultdict(int))

        grouped_data = {}

        for r in records:
            project_key = f"{r.project_id}_{r.project_title}"
            
            if project_key not in grouped_data:
                grouped_data[project_key] = {
                    "project_id": r.project_id,
                    "project_title": r.project_title,
                    "academic_year": r.academic_year,
                    "documents": {
                        "srs": [], "sdd": [], "spmp": [], "std": [], "ri": []
                    }
                }
            
            target = grouped_data[project_key]
            
            for doc_type in ["srs", "sdd", "spmp", "std", "ri"]:
                path = getattr(r, f"{doc_type}_local_path")
                current_hash = getattr(r, f"{doc_type}_hash")
                
                if path and current_hash:
                    # If the hash is different from the previous archival run, it's a new version
                    if current_hash != last_hashes[project_key][doc_type]:
                        last_hashes[project_key][doc_type] = current_hash
                        doc_versions[project_key][doc_type] += 1
                        
                        target["documents"][doc_type].append({
                            "id": r.id,
                            "version": doc_versions[project_key][doc_type], # CORRECT: Per-doc version
                            "hash": current_hash,
                            "timestamp": r.archived_at.strftime("%Y-%m-%d %H:%M:%S") if r.archived_at else None,
                            "status": r.status
                        })

        # Reverse to show newest first for the UI
        result = list(grouped_data.values())
        for project in result:
            for doc_type in project["documents"]:
                project["documents"][doc_type].reverse()

        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"Ledger Group Error: {e}")
        return jsonify([])

@registry_bp.route('/api/registry/ledger/tabs', methods=['GET'])
@login_required
def get_ledger_tabs():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        from models import ArchivalLedger
        # Get distinct academic years from the database
        years = db.session.query(ArchivalLedger.academic_year).distinct().all()
        return jsonify([y[0] for y in years if y and y[0]])
    except Exception as e:
        current_app.logger.error(f"Ledger Tabs Error: {e}")
        return jsonify([])

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
        defer(ArchivalLedger.sdd_binary),
        defer(ArchivalLedger.spmp_binary),
        defer(ArchivalLedger.std_binary),
        defer(ArchivalLedger.ri_binary)
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
        "spmp_path": r.spmp_local_path,
        "std_path": r.std_local_path,
        "ri_path": r.ri_local_path,
        "srs_hash": r.srs_hash,
        "sdd_hash": r.sdd_hash,
        "spmp_hash": r.spmp_hash,
        "std_hash": r.std_hash,
        "ri_hash": r.ri_hash,
        "error": r.error_message,
        "archived_at": r.archived_at.strftime("%Y-%m-%d %H:%M:%S") if r.archived_at else None
    } for r in records])

@registry_bp.route('/api/registry/ledger/<int:ledger_id>', methods=['DELETE'])
@login_required
def delete_ledger_record(ledger_id):
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
    
    from models import ArchivalLedger
    import shutil
    
    record = ArchivalLedger.query.get_or_404(ledger_id)
    
    try:
        # 1. Delete physical files from disk if they exist
        import re
        import shutil
        sample_path = record.srs_local_path or record.sdd_local_path or record.spmp_local_path
        
        if sample_path:
            parts = re.split(r'[\\/]', sample_path)
            if len(parts) >= 2:
                # Build path safely
                wb_dir = parts[0]
                proj_dir_name = parts[1]
                full_proj_path = os.path.join(current_app.root_path, 'Capstone_Archives', wb_dir, proj_dir_name)
                
                if os.path.exists(full_proj_path):
                    shutil.rmtree(full_proj_path)
                    print(f"DEBUG: Deleted disk folder {full_proj_path}")

        # 2. Delete from Database
        db.session.delete(record)
        db.session.commit()
        print(f"DEBUG: Deleted DB record {ledger_id}")
        
        return jsonify({"message": "Successfully removed record"}), 200
    except Exception as e:
        db.session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"DELETE ERROR: {error_trace}")
        return jsonify({"error": str(e), "traceback": error_trace}), 500

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
