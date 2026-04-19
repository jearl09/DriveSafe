import csv
import requests
import os
import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from models import db, UploadedProject

teacher_bp = Blueprint('teacher', __name__)

@teacher_bp.route('/api/teacher/import-csv', methods=['POST'])
@login_required
def import_csv():
    if current_user.role != 'teacher':
        return jsonify({"error": "Only teachers can import verified lists"}), 403
        
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Please upload a CSV file"}), 400

    decoded_file = file.read().decode('utf-8').splitlines()
    reader = csv.DictReader(decoded_file)
    
    count = 0
    for row in reader:
        # Expected Headers: ProjectTitle, AcademicYear, SRS_URL, SDD_URL
        project_title = row.get('ProjectTitle')
        srs_link = row.get('SRS_URL')
        sdd_link = row.get('SDD_URL')

        if not project_title: continue
        
        # Don't import dummy links
        if srs_link and "dummy.pdf" in srs_link: srs_link = None
        if sdd_link and "dummy.pdf" in sdd_link: sdd_link = None

        if not srs_link and not sdd_link: continue

        # Add to PENDING reviews list
        new_project = UploadedProject(
            student_id=current_user.id, # Teacher importing
            project_name=project_title,
            srs_link=srs_link,
            sdd_link=sdd_link,
            status='pending'
        )
        db.session.add(new_project)
        count += 1

    db.session.commit()
    return jsonify({"message": f"Successfully imported {count} projects for review!"}), 200
