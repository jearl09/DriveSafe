import sqlalchemy
from sqlalchemy import create_engine, select, text
import os
import sys

# Add backend to path so we can import models
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from models import db, User, UploadedProject, Backup
from flask import Flask

# Configuration
SQLITE_PATH = 'backend/instance/drivesafe.db'
MARIADB_URL = 'mysql+pymysql://root:123Earl.@localhost:3306/drivesafe_prod'

def migrate():
    if not os.path.exists(SQLITE_PATH):
        print(f"Error: SQLite database not found at {SQLITE_PATH}")
        return

    # 1. Initialize Flask App to use SQLAlchemy Models
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = MARIADB_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    # 2. Create Schema in MariaDB using Models
    print("Creating MariaDB schema...")
    try:
        with app.app_context():
            db.create_all()
        print("Schema created successfully.")
    except Exception as e:
        print(f"Error creating schema: {e}")
        return

    # 3. Prepare Engines for Data Transfer
    sqlite_engine = create_engine(f'sqlite:///{SQLITE_PATH}')
    mariadb_engine = create_engine(MARIADB_URL)

    # Tables to migrate
    # Format: (ModelClass, TableName)
    tables_to_migrate = [
        (User, 'user'),
        (Backup, 'backup'),
        (UploadedProject, 'uploaded_project')
    ]

    try:
        with mariadb_engine.connect() as mariadb_conn:
            # Disable Foreign Key Checks for the duration of data insertion
            print("Disabling foreign key checks...")
            mariadb_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

            for model, table_name in tables_to_migrate:
                print(f"Migrating data for table: {table_name}...")
                
                # Fetch data from SQLite
                with sqlite_engine.connect() as sqlite_conn:
                    # Using the model's table object directly from SQLAlchemy
                    sqlite_data = sqlite_conn.execute(select(model.__table__)).fetchall()
                
                if not sqlite_data:
                    print(f"No data in {table_name}, skipping.")
                    continue

                # Clear existing data in MariaDB table to avoid duplicates
                mariadb_conn.execute(model.__table__.delete())
                
                # Insert data into MariaDB
                # Convert rows to dicts for insertion
                insert_data = [dict(row._mapping) for row in sqlite_data]
                mariadb_conn.execute(model.__table__.insert(), insert_data)
                
                print(f"Successfully migrated {len(sqlite_data)} rows into {table_name}.")

            # Re-enable Foreign Key Checks
            print("Re-enabling foreign key checks...")
            mariadb_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            mariadb_conn.commit()

    except Exception as e:
        print(f"An error occurred during migration: {e}")
        return

    print("\nMigration completed successfully!")

if __name__ == '__main__':
    print("--- DriveSafe Robust SQLite to MariaDB Migration ---")
    migrate()
