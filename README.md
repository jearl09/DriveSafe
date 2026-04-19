# DriveSafe: Intelligent Capstone Archival System

DriveSafe is an automated archival system designed for the College of Computer Studies at Cebu Institute of Technology University. It streamlines the submission, review, and local archival of academic projects (SRS/SDD) directly from Google Drive.

## 🚀 Core Features

- **Google OAuth 2.0:** Secure institutional or personal Google login.
- **Student Submission:** Direct submission of Google Drive links for SRS and SDD documents.
- **Teacher Dashboard (IntelliTrack):** 
    - Batch import projects via CSV.
    - Live review of submitted document links.
    - One-click approval and automated local archival.
- **Automated Archival:** Files are automatically downloaded from Drive and organized into a "Year_Project_Team" folder hierarchy.
- **AI-Powered Stats:** Built-in AI engine to detect and categorize academic vs personal files.
- **Data Privacy:** Compliant with RA 10173 (Data Privacy Act of 2012).

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Axios.
- **Backend:** Python 3.11+, Flask.
- **Database:** SQLite (SQLAlchemy).
- **Authentication:** Flask-Login & Google OAuth 2.0.
- **API:** Google Drive API v3.

## 📋 Setup Instructions

### 1. Prerequisites
- **Node.js 18+**
- **Python 3.11+**
- **Google Cloud Credentials:** An `OAuth 2.0 Client ID` (Web Application type).

### 2. Backend Setup (Flask)
```powershell
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Place your Google credentials
# Download your JSON from Google Console and rename it to 'client_secret.json' inside /backend
```

### 3. Frontend Setup (React + Vite)
```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Database Initialization
On the first run, the database (`instance/drivesafe.db`) is created automatically. If you update the code and get column errors, run:
```powershell
python backend/force_fix.py
```

## 🔐 Role Management (Very Important)

By default, all new users are registered as **students**. To test the Teacher Review dashboard, you must manually upgrade your account:

1. Log in to the web app once.
2. Run the upgrade script in your terminal:
   ```powershell
   python backend/set_teacher.py
   ```
3. Logout and Login again to see the `⚖️ Review Submissions` menu.

To switch back to student:
```powershell
python backend/set_student.py
```

## 📊 Teacher CSV Format
When importing batch projects, use a `.csv` file with these headers:
`ProjectTitle, AcademicYear, SRS_URL, SDD_URL`

## 👥 Team Members

| Name | Role | GitHub |
| --- | --- | --- |
| John Earl F. Mandawe | Senior Developer | @johnearl |
| Lyrech James E. Laspiñas | Frontend/UI | @lyrech |
| Louis Drey F. Castañeto | Developer | @louisdrey |
| Clyde Nixon Jumawan | Developer | @klaydgg12 |
| Mark Joenylle B. Cortes | Developer | @markjoenylle |

---
**© 2025 CEBU INSTITUTE OF TECHNOLOGY UNIVERSITY - College of Computer Studies**
