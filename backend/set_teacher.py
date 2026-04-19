import sqlite3
import os

# The database was found here:
db_path = os.path.join(os.getcwd(), 'instance', 'drivesafe.db')
target_email = 'johnearlmandawe17@gmail.com'

if not os.path.exists(db_path):
    print(f"ERROR: Database not found at {db_path}")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT name, role FROM user WHERE email=?", (target_email,))
        user = cursor.fetchone()
        
        if user:
            cursor.execute("UPDATE user SET role='teacher' WHERE email=?", (target_email,))
            conn.commit()
            print(f"SUCCESS: Role for {target_email} ({user[0]}) updated to 'teacher' in {db_path}.")
            print("Now Logout and Login again in your browser to see the Teacher Dashboard!")
        else:
            print(f"ERROR: User with email {target_email} not found in {db_path}.")
            
        conn.close()
    except Exception as e:
        print(f"ERROR: {str(e)}")
