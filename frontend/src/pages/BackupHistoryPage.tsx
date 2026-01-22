// BackupHistoryPage.tsx
// Updated for DriveSafe "Librarian Mode" (Permanent Repository)

import React, { useEffect, useMemo, useState } from "react";
import "../App.css";

// Updated Type Definition to match the new Backend
type BackupRecord = {
  id: number;
  filename: string; // This is now the Project Folder Name (e.g., 2026_DRIVESAFE_TEAM_16)
  date: string;
  status: string;
  local_path: string; // New field from backend
  file_count?: number;
};

const BackupHistoryPage = () => {
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail] = useState(localStorage.getItem("user_email") || "user@example.com");
  const [userName] = useState(localStorage.getItem("user_name") || "Authenticated via Google");

  useEffect(() => {
    const fetchHistory = async () => {
      // 1. Get Token for Auth
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:5000/history", {
          headers: {
            'Authorization': `Bearer ${token}` // Send Token to Backend
          }
        });
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setHistory(data);
        } else {
          setHistory([]);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.hash = "";
  };

  // --- NEW: HANDLE MANUAL DELETE ---
  const handleDelete = async (folderName: string) => {
    if (!window.confirm(`Are you sure you want to delete the project "${folderName}"?\n\nThis will permanently delete the folder from your hard drive.`)) {
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/archive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_name: folderName }),
      });

      if (response.ok) {
        // Remove from list immediately (UI Update)
        setHistory(prev => prev.filter(item => item.filename !== folderName));
        alert("Project deleted successfully.");
      } else {
        alert("Failed to delete project. It may already be gone.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Error connecting to server.");
    }
  };

  // --- NEW: SHOW LOCAL PATH ---
const handleOpenFile = (path: string) => {
    // 1. Convert local path "D:\Archives\..." to a URL encoded string
    const encodedPath = encodeURIComponent(path);
    
    // 2. Open it in a new browser tab using our Backend API
    window.open(`http://localhost:5000/api/open-file?path=${encodedPath}`, '_blank');
  };

  const stats = useMemo(() => {
    const successCount = history.filter((item) => {
      const status = (item.status || "").toLowerCase();
      return status === "archived" || status === "success";
    }).length;
    const total = history.length;
    return {
      totalArchives: history.length,
      successRate: total ? Math.round((successCount / total) * 100) : 0,
    };
  }, [history]);

  return (
    <div className="drivesafe-dashboard-page">
      {/* Header Section */}
      <header className="header">
        <div className="container">
          <div className="dashboard-logo-section">
            <div className="dashboard-logo-icon-gradient">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="28" height="28" rx="4" fill="url(#gradient)"/>
                <rect x="8" y="8" width="16" height="12" rx="1" stroke="white" strokeWidth="1.5" fill="none"/>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                    <stop offset="0%" stopColor="#2563eb"/>
                    <stop offset="100%" stopColor="#9333ea"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="dashboard-logo-text">
              <div className="dashboard-logo-title">DriveSafe</div>
              <div className="dashboard-logo-subtitle">Capstone Archiver</div>
            </div>
          </div>
          <div className="dashboard-user-section">
            <div className="dashboard-user-info">
              <div className="dashboard-user-email">{userEmail}</div>
              <div className="dashboard-user-auth">{userName}</div>
            </div>
            <button className="dashboard-logout-btn" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 4L14 4L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Navigation */}
      <nav className="dashboard-nav">
        <div className="container">
          <div className="dashboard-nav-container">
            <a href="#dashboard" className="dashboard-nav-item">
              <span>New Archive</span>
            </a>
            <a href="#backup-history" className="dashboard-nav-item active">
              <span>Repository</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="container">
          
          {/* Summary Cards */}
          <div className="history-summary-cards">
            <div className="summary-card">
              <div className="summary-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4H20C20.5523 4 21 4.44772 21 5V19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19V5C3 4.44772 3.44772 4 4 4Z" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="summary-card-content">
                <div className="summary-card-label">Total Projects</div>
                <div className="summary-card-value">{stats.totalArchives}</div>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-card-icon success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13L9 17L19 7" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="summary-card-content">
                <div className="summary-card-label">Organization Status</div>
                <div className="summary-card-value">{stats.successRate > 0 ? "Active" : "Idle"}</div>
              </div>
            </div>
          </div>

          {/* Repository Section */}
          <div className="history-section">
            <div className="history-header">
              <h1 className="history-title">Capstone Repository</h1>
              <p className="history-subtitle">Manage your permanently archived projects</p>
            </div>

            {history.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                <h3>No projects archived yet.</h3>
                <p>Go to the Dashboard to archive your first Capstone project!</p>
              </div>
            )}

            <div className="backup-list">
              {history.map((item) => (
                <div key={item.id} className="backup-item">
                  <div className="backup-item-left">
                    <div className="backup-icon">
                       {/* Folder Icon */}
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" fill="#e0f2fe" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="backup-details">
                      {/* Filename is now the FOLDER NAME (e.g. 2026_Project_Team1) */}
                      <div className="backup-filename">{item.filename}</div>
                      <div className="backup-meta">
                        <span className="backup-date">{item.date}</span>
                        <span className="backup-status" style={{color: 'green'}}>
                          {item.status}
                        </span>
                        {/* No Expiry Badge - Files are permanent */}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="backup-item-right" style={{display: 'flex', gap: '10px'}}>
                   <button 
    className="btn-download" 
    onClick={() => handleOpenFile(item.local_path)} // Use local_path here
    style={{backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe'}}
  >
    <span>Open File</span>
  </button>

                    <button 
                      className="btn-download" 
                      onClick={() => handleDelete(item.filename)}
                      style={{backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'}}
                    >
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="dashboard-footer">
        <div className="container">
          <p>DriveSafe v2.0 © 2026 CEBU INSTITUTE OF TECHNOLOGY UNIVERSITY</p>
        </div>
      </footer>
    </div>
  );
};

export default BackupHistoryPage;