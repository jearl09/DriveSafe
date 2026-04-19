// DashboardPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";

const DashboardPage = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [userRole, setUserRole] = useState<string>("student");
  
  // Choice state: 'review' or 'direct'
  const [importMode, setImportMode] = useState<'review' | 'direct'>('review');

  const [userEmail] = useState(localStorage.getItem("user_email") || "user@example.com");
  const [userName] = useState(localStorage.getItem("user_name") || "Authenticated via Google");

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

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    // Send 'true' if mode is direct
    formData.append('direct_archive', (importMode === 'direct').toString());

    try {
        setLoading(true);
        const response = await axios.post('http://localhost:5000/api/teacher/import-csv', formData, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert(response.data.message);
        window.location.hash = response.data.redirect;
    } catch (err: any) {
        alert("Import failed: " + (err.response?.data?.error || err.message));
    } finally {
        setLoading(false);
    }
  };

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
            <button className="dashboard-logout-btn" onClick={() => {localStorage.clear(); window.location.hash=""}}>Logout</button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <div className="container">
          <div className="dashboard-nav-container">
            <a href="#dashboard" className="dashboard-nav-item active">Dashboard</a>
            <a href="#backup-history" className="dashboard-nav-item">Archive History</a>
            {userRole === 'student' && <a href="#upload" className="dashboard-nav-item" style={{ color: '#2563eb', fontWeight: 'bold' }}>📤 Upload Project</a>}
            {userRole === 'teacher' && <a href="#review" className="dashboard-nav-item" style={{ color: '#9333ea', fontWeight: 'bold' }}>⚖️ Review Submissions</a>}
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="container">
          <div className="dashboard-card">
            <h1 className="dashboard-card-title">Welcome to DriveSafe</h1>
            
            {userRole === 'teacher' && (
                <div style={{ background: '#f5f3ff', padding: '30px', borderRadius: '20px', border: '1px solid #ddd6fe', marginBottom: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ color: '#5b21b6', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Batch Import Projects (CSV)</h3>
                        <p style={{ fontSize: '0.875rem', color: '#7c3aed', marginTop: '4px' }}>Upload a verified list to populate the archival queue.</p>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                        {/* MODE SELECTOR */}
                        <div style={{ display: 'flex', background: '#ede9fe', padding: '4px', borderRadius: '12px' }}>
                            <button 
                                onClick={() => setImportMode('review')}
                                style={{ 
                                    padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                    background: importMode === 'review' ? '#fff' : 'transparent',
                                    color: importMode === 'review' ? '#7c3aed' : '#94a3b8',
                                    boxShadow: importMode === 'review' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >
                                👀 Send to Review
                            </button>
                            <button 
                                onClick={() => setImportMode('direct')}
                                style={{ 
                                    padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                    background: importMode === 'direct' ? '#fff' : 'transparent',
                                    color: importMode === 'direct' ? '#7c3aed' : '#94a3b8',
                                    boxShadow: importMode === 'direct' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >
                                🚀 Instant Archive
                            </button>
                        </div>

                        <div style={{ flex: 1 }}>
                            <input type="file" accept=".csv" onChange={handleCSVImport} style={{ fontSize: '0.875rem' }} />
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '15px', padding: '10px 15px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd6fe', fontSize: '0.75rem', color: '#6d28d9' }}>
                        <strong>Mode Info:</strong> {importMode === 'review' ? 
                          "Projects will be added to the Review Dashboard for you to verify links before archival." : 
                          "Files will be downloaded and archived locally immediately after upload."}
                    </div>
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

            <button className="btn-start-backup" onClick={handleStartBackup} disabled={isBackingUp || loading}>
              {isBackingUp ? "Processing..." : "Archive My Drive Files"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
