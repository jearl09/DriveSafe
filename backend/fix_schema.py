import os
import sqlite3
from app import app, db

db_path = os.path.join(os.getcwd(), 'instance', 'drivesafe.db')

print(f"--- Fixing Database Schema in {db_path} ---")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Drop the old table so it can be recreated correctly
    print("Dropping old 'uploaded_project' table...")
    cursor.execute("DROP TABLE IF EXISTS uploaded_project")
    conn.commit()
    conn.close()
    
    # 2. Use Flask-SQLAlchemy to recreate it with the NEW schema
    print("Recreating table with new 'srs_link' and 'sdd_link' columns...")
    with app.app_context():
        db.create_all()
        
    print("SUCCESS: Database schema is now up to date!")
    print("You can now restart your backend and try submitting links again.")

except Exception as e:
    print(f"ERROR: {str(e)}")
