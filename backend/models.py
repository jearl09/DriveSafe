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
    role = db.Column(db.String(20), default='teacher') 
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class ArchivalLedger(db.Model):
    __tablename__ = 'archival_ledger'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(50), nullable=True)
    project_title = db.Column(db.String(255), nullable=False)
    academic_year = db.Column(db.String(50), nullable=False)
    srs_original_url = db.Column(db.String(500), nullable=True)
    sdd_original_url = db.Column(db.String(500), nullable=True) # Renamed
    srs_local_path = db.Column(db.String(500), nullable=True)
    sdd_local_path = db.Column(db.String(500), nullable=True) # Renamed
    srs_hash = db.Column(db.String(64), nullable=True)
    sdd_hash = db.Column(db.String(64), nullable=True) # Renamed
    status = db.Column(db.String(50), default='pending')
    error_message = db.Column(db.Text, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
