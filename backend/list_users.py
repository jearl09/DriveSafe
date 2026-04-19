import sqlite3
import os

# Let's search for ANY drivesafe.db file in the current project
print("--- Searching for users in all drivesafe.db files ---")
for root, dirs, files in os.walk('.'):
    for file in files:
        if file == 'drivesafe.db':
            db_path = os.path.join(root, file)
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
                if cursor.fetchone():
                    cursor.execute("SELECT email, role, name FROM user")
                    users = cursor.fetchall()
                    if users:
                        print(f"\nDB: {db_path}")
                        for u in users:
                            print(f"  Email: {u[0]} | Role: {u[1]} | Name: {u[2]}")
                    else:
                        print(f"\nDB: {db_path} (Empty - No users found)")
                conn.close()
            except Exception as e:
                print(f"Error checking {db_path}: {e}")
