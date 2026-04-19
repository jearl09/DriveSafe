import os
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
import datetime

db = SQLAlchemy()

DEFAULT_ARCHIVE_PATH = os.path.join(os.getcwd(), 'Capstone_Archives')

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(120))
    role = db.Column(db.String(20), default='student')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class UploadedProject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_name = db.Column(db.String(200), nullable=False)
    # NEW: Store links instead of local paths
    srs_link = db.Column(db.String(500), nullable=True)
    sdd_link = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(50), default='pending') 
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    archive_ref = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Backup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(120), nullable=False)
    filename = db.Column(db.String(200))
    date = db.Column(db.String(50))
    file_count = db.Column(db.Integer)
    status = db.Column(db.String(50))
    local_path = db.Column(db.String(500))
