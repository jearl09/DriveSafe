from waitress import serve
from app import app
import logging
import os

# Set up logging to see production traffic
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('waitress')

if __name__ == '__main__':
    # Railway provides the port via the PORT environment variable
    port = int(os.environ.get("PORT", 8080))
    
    print("--------------------------------------------------")
    print("DriveSafe Production Server is starting...")
    print(f"Listening on: 0.0.0.0:{port}")
    print("Serving frontend from: ../frontend/dist")
    print("--------------------------------------------------")
    
    # Run the app on the dynamic port
    serve(app, host='0.0.0.0', port=port)
