from waitress import serve
from app import app
import logging

# Set up logging to see production traffic
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('waitress')

if __name__ == '__main__':
    print("--------------------------------------------------")
    print("DriveSafe Production Server is starting...")
    print("URL: http://localhost:8080")
    print("Serving frontend from: ../frontend/dist")
    print("--------------------------------------------------")
    
    # Run the app on port 8080
    serve(app, host='0.0.0.0', port=8080)
