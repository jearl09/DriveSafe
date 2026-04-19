# DriveSafe: Intelligent Capstone Archival System

DriveSafe is a specialized archival and tracking system designed for the College of Computer Studies at Cebu Institute of Technology University. It streamlines the transition of academic projects from student cloud storage to a standardized, teacher-verified local repository.

## 🚀 Actual Implemented Modules

- **Google OAuth 2.0 Integration:** Secure login using Google accounts, with automatic role detection for students and faculty.
- **IntelliTrack Submission (Student):** 
    - A smart "Drive Browser" that automatically identifies SRS and SDD documents in the student's Google Drive.
    - Link-based submission system to avoid redundant file uploads.
- **Verification Gatekeeper (Teacher):**
    - **Batch CSV Import:** Ability to import verified project lists from Excel/CSV for large-scale tracking.
    - **Live Document Review:** One-click preview of student-submitted links to verify content before archival.
    - **Secure Approval:** Teachers act as the final authority to trigger the archival process.
- **Standardized Local Archival:** 
    - Automated "Pull" system that downloads verified documents from the cloud.
    - Intelligent folder organization (e.g., `Capstone_Archives/2025-2026_PROJECT_TITLE/`).
    - Automatic file renaming and sorting.
- **Audit & History:** A persistent digital log of all archived projects, searchable by project title and document type.
- **Data Privacy:** Fully compliant with RA 10173 (Data Privacy Act of 2012) by ensuring data is only accessed by authorized faculty.

## 🛠 Tech Stack

- **Frontend:** React 19 (TypeScript, Vite, Axios)
- **Backend:** Python 3.11+ (Flask, Flask-Login, Flask-SQLAlchemy)
- **Database:** SQLite (Relational structure for Users, Submissions, and Archives)
- **API:** Google Drive API v3 (OAuth 2.0)

## 📋 Quick Start

### 1. Prerequisites
- Node.js 18+ & Python 3.11+
- Google Cloud `client_secret.json` placed in the `/backend` folder.

### 2. Run the System
**Backend:**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

## 🔐 Role Demo Logic
To demonstrate the system effectively during the Capstone demo:
- **Default:** All new signups are students.
- **Teacher Mode:** Run `python backend/set_teacher.py` to upgrade your account.
- **Student Mode:** Run `python backend/set_student.py` to revert.

## 👥 Development Team
- **John Earl F. Mandawe** - Senior Developer (Backend & Security Integration)
- **Lyrech James E. Laspiñas** - Frontend Architect & UI Design
- **Louis Drey F. Castañeto** - Core Module Developer
- **Clyde Nixon Jumawan** - Systems Integration & Git Lead
- **Mark Joenylle B. Cortes** - Quality Assurance & Deployment

---
**© 2025 CEBU INSTITUTE OF TECHNOLOGY UNIVERSITY - College of Computer Studies**
