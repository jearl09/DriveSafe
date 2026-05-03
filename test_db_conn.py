import os
import dotenv
from sqlalchemy import create_engine, text

dotenv.load_dotenv()

def get_robust_database_uri():
    raw_url = os.getenv('DATABASE_URL', 'mysql+pymysql://root:123Earl.@localhost/drivesafe_prod').strip().strip("'").strip('"')
    if not raw_url or len(raw_url) < 10 or "://" not in raw_url:
        return 'sqlite:///drivesafe.db'
    
    db_url = raw_url
    if raw_url.startswith('mariadb://'):
        db_url = raw_url.replace('mariadb://', 'mysql+pymysql://', 1)
    elif raw_url.startswith('mysql://') and 'pymysql' not in raw_url:
        db_url = raw_url.replace('mysql://', 'mysql+pymysql://', 1)
    return db_url

db_url = get_robust_database_uri()
print(f"Testing connection to: {db_url}")

try:
    engine = create_engine(db_url)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print(f"Connection successful: {result.fetchone()}")
except Exception as e:
    print(f"Connection failed: {e}")
