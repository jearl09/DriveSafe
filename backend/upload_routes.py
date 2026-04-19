from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from models import db, UploadedProject

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/api/upload', methods=['POST'])
@login_required
def upload_links():
    if current_user.role != 'student':
        return jsonify({"error": "Only students can submit project links"}), 403
        
    data = request.json
    project_name = data.get('project_name')
    srs_link = data.get('srs_link')
    sdd_link = data.get('sdd_link')
    
    if not project_name:
        return jsonify({"error": "Project name is required"}), 400
    if not srs_link and not sdd_link:
        return jsonify({"error": "At least one link (SRS or SDD) is required"}), 400

    new_project = UploadedProject(
        student_id=current_user.id,
        project_name=project_name,
        srs_link=srs_link,
        sdd_link=sdd_link,
        status='pending'
    )
    
    db.session.add(new_project)
    db.session.commit()
    
    return jsonify({"message": "Project links submitted successfully for review!", "project_id": new_project.id}), 201
