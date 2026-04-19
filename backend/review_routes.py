from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from models import db, UploadedProject, User
import datetime
import os
from archive_trigger import run_archival_on_links

review_bp = Blueprint('review', __name__)

@review_bp.route('/api/pending-reviews', methods=['GET'])
@login_required
def get_pending_reviews():
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
        
    pending = UploadedProject.query.filter_by(status='pending').all()
    results = []
    for p in pending:
        student = User.query.get(p.student_id)
        results.append({
            "id": p.id,
            "student_name": student.name if student else "System Import",
            "project_name": p.project_name,
            "srs_link": p.srs_link,
            "sdd_link": p.sdd_link,
            "date": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else "N/A"
        })
    return jsonify(results)

@review_bp.route('/api/approve/<int:project_id>', methods=['POST'])
@login_required
def approve_project(project_id):
    if current_user.role != 'teacher':
        return jsonify({"error": "Unauthorized"}), 403
        
    project = UploadedProject.query.get_or_404(project_id)
    if project.status != 'pending':
        return jsonify({"error": "Project is already processed"}), 400
        
    project.status = 'approved'
    project.approved_by = current_user.id
    project.approved_at = datetime.datetime.utcnow()
    db.session.commit()
    
    # Trigger Archival from the links
    try:
        archive_path = run_archival_on_links(project)
        project.status = 'archived'
        project.archive_ref = archive_path
        db.session.commit()
        return jsonify({"message": "Project approved and files archived from links!", "archive_path": archive_path})
    except Exception as e:
        return jsonify({"error": f"Archival from links failed: {str(e)}"}), 500
