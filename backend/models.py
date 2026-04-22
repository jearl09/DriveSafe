import os
import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()

class User(db.Model, UserMixin):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(120))
    role = db.Column(db.String(20), default='teacher') # Default to teacher for this pivot
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class ArchivalLedger(db.Model):
    __tablename__ = 'archival_ledger'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(50), nullable=True) # ID from Google Sheet
    project_title = db.Column(db.String(255), nullable=False)
    academic_year = db.Column(db.String(50), nullable=False)
    srs_original_url = db.Column(db.String(500), nullable=True)
    sds_original_url = db.Column(db.String(500), nullable=True)
    srs_local_path = db.Column(db.String(500), nullable=True)
    sds_local_path = db.Column(db.String(500), nullable=True)
    srs_hash = db.Column(db.String(64), nullable=True) # SHA-256
    sds_hash = db.Column(db.String(64), nullable=True) # SHA-256
    status = db.Column(db.String(50), default='pending') # pending, archived, failed
    error_message = db.Column(db.Text, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class UploadedProject(db.Model):
    """Keep for migration, but no longer used for new uploads"""
    __tablename__ = 'uploaded_project'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(50), nullable=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    project_name = db.Column(db.String(200), nullable=False)
    academic_year = db.Column(db.String(50), nullable=True)
    srs_link = db.Column(db.String(500), nullable=True)
    sdd_link = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(50), default='pending') 
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    archive_ref = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Backup(db.Model):
    """Keep for migration history"""
    __tablename__ = 'backup'
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(120), nullable=False)
    filename = db.Column(db.String(200))
    date = db.Column(db.String(50))
    file_count = db.Column(db.Integer)
    status = db.Column(db.String(50))
    local_path = db.Column(db.String(500))
    file_hash = db.Column(db.String(100), nullable=True)
