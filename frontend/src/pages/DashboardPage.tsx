// DashboardPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";

const DashboardPage = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [userRole, setUserRole] = useState<string>("student");

  const [userEmail, setUserEmail] = useState(localStorage.getItem("user_email") || "user@example.com");
  const [userName, setUserName] = useState(localStorage.getItem("user_name") || "Authenticated via Google");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/user-info', { withCredentials: true });
        setUserRole(response.data.role);
      } catch (err) {
        console.error("Failed to fetch user info", err);
      }
    };

    const fetchDriveFiles = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/drive/files', { withCredentials: true });
        if (response.data.files) {
          setFiles(response.data.files);
          setStats(response.data.ai_stats);
        }
      } catch (error) {
        console.error("Connection Failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    fetchDriveFiles();
  }, []);

  const filteredFiles = files.filter(file => {
    if (activeTab === "All") return true;
    return file.category === activeTab;
  });

  const handleStartBackup = async () => {
    setIsBackingUp(true);
    try {
      const response = await axios.post('http://localhost:5000/drive/backup', {}, { 
        withCredentials: true,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DriveSafe_Archive_${new Date().toISOString().slice(0,10)}.zip`);
      document.body.appendChild(link);
      link.click();
      alert("Backup Complete!");
      window.location.hash = "backup-history";
    } catch (error) {
      alert("Backup Failed");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.hash = "";
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        setLoading(true);
        await axios.post('http://localhost:5000/api/teacher/import-csv', formData, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert("CSV Processed and files archived successfully!");
        window.location.hash = "backup-history";
    } catch (err: any) {
        alert("Import failed: " + (err.response?.data?.error || err.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="drivesafe-dashboard-page">
      <header className="header">
        <div className="container">
          <div className="dashboard-logo-section">
            <div className="dashboard-logo-icon-gradient">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="28" height="28" rx="4" fill="url(#gradient)"/>
                <rect x="8" y="8" width="16" height="12" rx="1" stroke="white" strokeWidth="1.5" fill="none"/>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                    <stop offset="0%" stopColor="#2563eb"/><stop offset="100%" stopColor="#9333ea"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="dashboard-logo-text">
              <div className="dashboard-logo-title">DriveSafe</div>
              <div className="dashboard-logo-subtitle">Automated Archival Tool</div>
            </div>
          </div>
          <div className="dashboard-user-section">
            <div className="dashboard-user-info">
              <div className="dashboard-user-email">{userEmail}</div>
              <div className="dashboard-user-auth">{userName} ({userRole.toUpperCase()})</div>
            </div>
            <button className="dashboard-logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <div className="container">
          <div className="dashboard-nav-container">
            <a href="#dashboard" className="dashboard-nav-item active">Dashboard</a>
            <a href="#backup-history" className="dashboard-nav-item">Archive History</a>
            
            {/* ROLE-BASED NAVIGATION */}
            {userRole === 'student' && (
                <a href="#upload" className="dashboard-nav-item" style={{ color: '#2563eb', fontWeight: 'bold' }}>📤 Upload Project</a>
            )}
            {userRole === 'teacher' && (
                <a href="#review" className="dashboard-nav-item" style={{ color: '#9333ea', fontWeight: 'bold' }}>⚖️ Review Submissions</a>
            )}
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="container">
          <div className="dashboard-card">
            <h1 className="dashboard-card-title">Welcome to DriveSafe</h1>
            
            {/* TEACHER CSV UPLOAD SECTION */}
            {userRole === 'teacher' && (
                <div style={{ background: '#f5f3ff', padding: '20px', borderRadius: '12px', border: '2px dashed #9333ea', marginBottom: '20px' }}>
                    <h3 style={{ color: '#7c3aed', marginBottom: '10px' }}>Import Verified Project List (CSV)</h3>
                    <p style={{ fontSize: '13px', color: '#6d28d9' }}>Upload the Excel/CSV file containing SRS/SDD links to automatically download and archive them.</p>
                    <input type="file" accept=".csv" onChange={handleCSVImport} style={{ marginTop: '10px' }} />
                </div>
            )}

            <div className="dashboard-metrics">
              <div className="dashboard-metric-card metric-blue">
                <div className="metric-label">Drive Files Found</div>
                <div className="metric-value">{files.length}</div>
              </div>
              <div className="dashboard-metric-card metric-purple">
                <div className="metric-label">AI-Detected Academic</div>
                <div className="metric-value">{stats?.Academic || 0}</div>
              </div>
            </div>

            <button 
              className="btn-start-backup" 
              onClick={handleStartBackup} 
              disabled={isBackingUp || loading}
            >
              {isBackingUp ? "Processing..." : "Archive My Drive Files"}
            </button>
            
            <p style={{ marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
                All files are processed according to RA 10173 Data Privacy Act.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
