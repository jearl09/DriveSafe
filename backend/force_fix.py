import os
import sqlite3
from app import app, db

# Force target the instance folder database
db_path = os.path.join(os.getcwd(), 'instance', 'drivesafe.db')

print(f"--- FORCE FIX: {db_path} ---")

if not os.path.exists(db_path):
    print("Error: Database file not found in instance folder!")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Drop the old table
        print("Dropping old table...")
        cursor.execute("DROP TABLE IF EXISTS uploaded_project")
        conn.commit()
        conn.close()
        
        # 2. Use the App Context to recreate it correctly
        print("Recreating table via SQLAlchemy with academic_year support...")
        with app.app_context():
            db.create_all()
            
        print("\nSUCCESS: Table 'uploaded_project' now includes 'academic_year', 'srs_link' and 'sdd_link'.")
        print("Please restart your backend (python backend/app.py) and try again.")

    except Exception as e:
        print(f"ERROR: {str(e)}")
