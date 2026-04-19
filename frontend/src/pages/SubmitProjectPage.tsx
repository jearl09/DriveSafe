import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

const SubmitProjectPage = () => {
    const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<DriveFile[]>([]);
    const [projectName, setProjectName] = useState('');
    const [srsFile, setSrsFile] = useState<DriveFile | null>(null);
    const [sddFile, setSddFile] = useState<DriveFile | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchDriveFiles = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://localhost:5000/drive/files', { withCredentials: true });
                const allFiles: DriveFile[] = response.data.files || [];
                setDriveFiles(allFiles);
                
                // Auto-detect files containing SRS or SDD in name
                const filtered = allFiles.filter(f => 
                    f.name.toLowerCase().includes('srs') || 
                    f.name.toLowerCase().includes('sdd')
                );
                setFilteredFiles(filtered);
            } catch (err) {
                console.error("Failed to load drive files", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDriveFiles();
    }, []);

    const selectFile = (file: DriveFile, type: 'SRS' | 'SDD') => {
        if (type === 'SRS') setSrsFile(file);
        else setSddFile(file);
        setMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName || (!srsFile && !sddFile)) {
            alert("Please provide a project title and at least one document.");
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('http://localhost:5000/api/upload', {
                project_name: projectName,
                srs_link: srsFile ? `https://drive.google.com/file/d/${srsFile.id}/view` : null,
                sdd_link: sddFile ? `https://drive.google.com/file/d/${sddFile.id}/view` : null
            }, { withCredentials: true });
            
            setMessage({ type: 'success', text: "Submission successful! Your project is now pending review." });
            setProjectName('');
            setSrsFile(null);
            setSddFile(null);
        } catch (error: any) {
            setMessage({ type: 'error', text: "Submission failed: " + (error.response?.data?.error || error.message) });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="submit-page-container">
            {/* Top Navigation */}
            <div className="page-header-actions">
                <button 
                    onClick={() => window.location.hash = "dashboard"} 
                    className="back-btn"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Dashboard
                </button>
            </div>

            <div className="submit-grid">
                {/* LEFT: FORM SECTION */}
                <div className="form-section">
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">Project Details</h2>
                            <p className="card-subtitle">Fill in the project info and select documents from your drive.</p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="project-form">
                            <div className="form-group">
                                <label>Project Title</label>
                                <input 
                                    type="text" 
                                    value={projectName} 
                                    onChange={(e) => setProjectName(e.target.value)} 
                                    className="form-input" 
                                    placeholder="e.g. Smart Traffic Analytics"
                                    required 
                                />
                            </div>

                            <div className="document-slots">
                                <div className={`doc-slot ${srsFile ? 'filled' : ''}`}>
                                    <div className="slot-label">SRS Document</div>
                                    {srsFile ? (
                                        <div className="selected-file">
                                            <span className="file-icon">📄</span>
                                            <span className="file-name">{srsFile.name}</span>
                                            <button type="button" onClick={() => setSrsFile(null)} className="remove-file">×</button>
                                        </div>
                                    ) : (
                                        <div className="empty-slot">Select from Drive →</div>
                                    )}
                                </div>

                                <div className={`doc-slot ${sddFile ? 'filled' : ''}`}>
                                    <div className="slot-label">SDD Document</div>
                                    {sddFile ? (
                                        <div className="selected-file">
                                            <span className="file-icon">📄</span>
                                            <span className="file-name">{sddFile.name}</span>
                                            <button type="button" onClick={() => setSddFile(null)} className="remove-file">×</button>
                                        </div>
                                    ) : (
                                        <div className="empty-slot">Select from Drive →</div>
                                    )}
                                </div>
                            </div>

                            <button type="submit" className="submit-btn" disabled={submitting}>
                                {submitting ? "Processing..." : "Submit for Review"}
                            </button>
                        </form>

                        {message && (
                            <div className={`alert ${message.type}`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: DRIVE BROWSER SECTION */}
                <div className="drive-section">
                    <div className="card drive-card">
                        <div className="card-header sticky-header">
                            <div className="drive-header-flex">
                                <h2 className="card-title">My Google Drive</h2>
                                <span className="badge">Auto-detected Docs</span>
                            </div>
                            <p className="card-subtitle">Showing documents with "SRS" or "SDD" in their name.</p>
                        </div>

                        <div className="drive-list">
                            {loading ? (
                                <div className="loader-container">
                                    <div className="spinner"></div>
                                    <p>Fetching files...</p>
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📁</span>
                                    <p>No SRS/SDD documents found in your Drive.</p>
                                </div>
                            ) : (
                                filteredFiles.map(file => (
                                    <div key={file.id} className={`file-row ${(srsFile?.id === file.id || sddFile?.id === file.id) ? 'active' : ''}`}>
                                        <div className="file-info">
                                            <span className="file-ext-icon">{file.name.split('.').pop()?.toUpperCase() || 'PDF'}</span>
                                            <span className="file-name-text">{file.name}</span>
                                        </div>
                                        <div className="file-actions">
                                            <button 
                                                onClick={() => selectFile(file, 'SRS')} 
                                                className={`action-btn ${srsFile?.id === file.id ? 'selected' : ''}`}
                                            >
                                                {srsFile?.id === file.id ? '✓ SRS Selected' : 'Set as SRS'}
                                            </button>
                                            <button 
                                                onClick={() => selectFile(file, 'SDD')} 
                                                className={`action-btn ${sddFile?.id === file.id ? 'selected' : ''}`}
                                            >
                                                {sddFile?.id === file.id ? '✓ SDD Selected' : 'Set as SDD'}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .submit-page-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    background-color: #f8fafc;
                    min-height: 100vh;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .page-header-actions { margin-bottom: 1.5rem; }

                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: none;
                    border: none;
                    color: #64748b;
                    font-weight: 500;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .back-btn:hover { color: #2563eb; }

                .submit-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.2fr;
                    gap: 2rem;
                }

                @media (max-width: 900px) {
                    .submit-grid { grid-template-columns: 1fr; }
                }

                .card {
                    background: white;
                    border-radius: 1rem;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    border: 1px solid #e2e8f0;
                    height: 100%;
                }

                .drive-card { 
                    display: flex; 
                    flex-direction: column;
                    max-height: 600px;
                }

                .card-header { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; }
                .card-title { margin: 0; font-size: 1.25rem; color: #1e293b; font-weight: 700; }
                .card-subtitle { margin: 0.25rem 0 0; font-size: 0.875rem; color: #64748b; }

                .project-form { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
                .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .form-group label { font-size: 0.875rem; font-weight: 600; color: #475569; }

                .form-input {
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    border: 1px solid #cbd5e1;
                    font-size: 1rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .form-input:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }

                .document-slots { display: flex; flex-direction: column; gap: 1rem; }
                .doc-slot {
                    padding: 1rem;
                    background: #f8fafc;
                    border: 2px dashed #cbd5e1;
                    border-radius: 0.75rem;
                    transition: all 0.2s;
                }
                .doc-slot.filled {
                    background: #f0fdf4;
                    border-style: solid;
                    border-color: #4ade80;
                }
                .slot-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.5rem; }

                .selected-file { display: flex; align-items: center; gap: 0.75rem; color: #166534; }
                .file-name { font-weight: 600; flex: 1; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; }
                .remove-file { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; }
                .remove-file:hover { color: #ef4444; }

                .submit-btn {
                    padding: 0.875rem;
                    background: #2563eb;
                    color: white;
                    border: none;
                    border-radius: 0.5rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .submit-btn:hover { background: #1d4ed8; }
                .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                .drive-list { padding: 1rem; overflow-y: auto; flex: 1; }
                .file-row {
                    padding: 1rem;
                    border-radius: 0.75rem;
                    border: 1px solid transparent;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    transition: all 0.2s;
                    margin-bottom: 0.5rem;
                }
                .file-row:hover { background: #f1f5f9; border-color: #e2e8f0; }
                .file-row.active { background: #eff6ff; border-color: #bfdbfe; }

                .file-info { display: flex; align-items: center; gap: 0.75rem; }
                .file-ext-icon {
                    background: #e2e8f0;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #475569;
                }
                .file-name-text { font-size: 0.9rem; font-weight: 500; color: #1e293b; }

                .file-actions { display: flex; gap: 0.5rem; }
                .action-btn {
                    flex: 1;
                    padding: 0.4rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    border-radius: 0.4rem;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .action-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
                .action-btn.selected {
                    background: #10b981;
                    color: white;
                    border-color: #10b981;
                }

                .alert { padding: 1rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; }
                .alert.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
                .alert.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

                .loader-container { padding: 3rem; text-align: center; color: #64748b; }
                .spinner {
                    width: 24px; height: 24px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #2563eb;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 1rem;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .badge {
                    background: #dcfce7;
                    color: #166534;
                    padding: 2px 8px;
                    border-radius: 1rem;
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .drive-header-flex { display: flex; align-items: center; justify-content: space-between; }
            `}</style>
        </div>
    );
};

export default SubmitProjectPage;
