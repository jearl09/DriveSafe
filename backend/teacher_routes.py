import csv
import requests
import os
import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from models import db, UploadedProject
from archive_trigger import run_archival_on_links

teacher_bp = Blueprint('teacher', __name__)

@teacher_bp.route('/api/teacher/import-csv', methods=['POST'])
@login_required
def import_csv():
    if current_user.role != 'teacher':
        return jsonify({"error": "Only teachers can import verified lists"}), 403
        
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    # Check for direct archive toggle from frontend
    direct_archive = request.form.get('direct_archive') == 'true'

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Please upload a CSV file"}), 400

    decoded_file = file.read().decode('utf-8').splitlines()
    reader = csv.DictReader(decoded_file)
    
    count = 0
    for row in reader:
        project_title = row.get('ProjectTitle')
        academic_year = row.get('AcademicYear', '2025-2026')
        srs_link = row.get('SRS_URL')
        sdd_link = row.get('SDD_URL')

        if not project_title: continue
        if not srs_link and not sdd_link: continue

        # Create record
        new_project = UploadedProject(
            student_id=current_user.id, 
            project_name=project_title,
            academic_year=academic_year,
            srs_link=srs_link,
            sdd_link=sdd_link,
            status='pending'
        )
        db.session.add(new_project)
        db.session.flush() # Get ID before commit if needed

        if direct_archive:
            try:
                run_archival_on_links(new_project)
                new_project.status = 'archived'
            except Exception as e:
                print(f"Direct archival failed for {project_title}: {e}")
        
        count += 1

    db.session.commit()
    msg = f"Successfully archived {count} projects!" if direct_archive else f"Imported {count} projects for review!"
    return jsonify({"message": msg, "redirect": "backup-history" if direct_archive else "review"}), 200
