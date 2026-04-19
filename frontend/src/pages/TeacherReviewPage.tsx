import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

interface PendingProject {
    id: number;
    student_name: string;
    project_name: string;
    academic_year: string;
    srs_link: string;
    sdd_link: string;
    date: string;
}

const TeacherReviewPage = () => {
    const [projects, setProjects] = useState<PendingProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchPending = async () => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:5000/api/pending-reviews', { withCredentials: true });
            if (Array.isArray(response.data)) {
                setProjects(response.data);
            } else {
                setError(response.data.error || "Unexpected response format");
                setProjects([]);
            }
        } catch (err: any) {
            setError("Failed to fetch reviews: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleApprove = async (id: number) => {
        if (!window.confirm("Are you sure you want to approve and archive these links?")) return;
        
        try {
            await axios.post(`http://localhost:5000/api/approve/${id}`, {}, { withCredentials: true });
            // Micro-interaction: Success alert before removing from list
            setProjects(projects.filter(p => p.id !== id));
        } catch (err: any) {
            alert("Approval failed: " + (err.response?.data?.error || err.message));
        }
    };

    // Filter Logic
    const filteredProjects = projects.filter(p => 
        p.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination Logic
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="review-dashboard-wrapper">
            {/* TOP NAVIGATION AREA */}
            <div className="top-nav-bar">
                <button onClick={() => window.location.hash = "dashboard"} className="back-navigation-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <span>Back to Dashboard</span>
                </button>
            </div>

            <main className="review-container">
                {/* HEADER SECTION */}
                <div className="review-header-flex">
                    <div className="header-text-group">
                        <div className="header-with-icon">
                            <div className="title-icon-wrapper">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            </div>
                            <h1>Teacher Review Dashboard <span className="brand-badge">IntelliTrack</span></h1>
                        </div>
                        <p className="subtitle-muted">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            Verify submitted Google Drive links before final local archival.
                        </p>
                    </div>

                    <div className="search-filter-group">
                        <div className="search-input-wrapper">
                            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                                type="text" 
                                placeholder="Search student or project..." 
                                value={searchTerm}
                                onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
                            />
                        </div>
                    </div>
                </div>

                {/* MAIN TABLE CARD */}
                <div className="table-card">
                    {loading ? (
                        <div className="loading-state">
                            <div className="skeleton-row header"></div>
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row"></div>)}
                        </div>
                    ) : error ? (
                        <div className="error-state-alert">
                            <p><strong>Fetch Error:</strong> {error}</p>
                            <button onClick={fetchPending}>Retry</button>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="empty-state-view">
                            <div className="empty-illustration">📁</div>
                            <h3>All Caught Up!</h3>
                            <p>No pending submissions require your review at this time.</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-responsive-wrapper">
                                <table className="modern-review-table">
                                    <thead>
                                        <tr>
                                            <th>STUDENT / SOURCE</th>
                                            <th>PROJECT TITLE</th>
                                            <th>ACADEMIC YEAR</th>
                                            <th>DOCUMENTS</th>
                                            <th className="text-right">ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedProjects.map(p => (
                                            <tr key={p.id}>
                                                <td className="student-col">
                                                    <div className="avatar-placeholder">{p.student_name.charAt(0)}</div>
                                                    <span className="name-bold">{p.student_name}</span>
                                                </td>
                                                <td className="project-title-col">{p.project_name}</td>
                                                <td>
                                                    <span className="year-pill">{p.academic_year || '—'}</span>
                                                </td>
                                                <td className="docs-col">
                                                    <div className="doc-link-group">
                                                        {p.srs_link && (
                                                            <a href={p.srs_link} target="_blank" rel="noreferrer" className="doc-preview-link srs">
                                                                SRS
                                                            </a>
                                                        )}
                                                        {p.sdd_link && (
                                                            <a href={p.sdd_link} target="_blank" rel="noreferrer" className="doc-preview-link sdd">
                                                                SDD
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <button className="approve-action-btn" onClick={() => handleApprove(p.id)}>
                                                        Approve
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div className="pagination-footer">
                                    <p>Showing {paginatedProjects.length} of {filteredProjects.length} results</p>
                                    <div className="pagination-btns">
                                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
                                        <span>Page {currentPage} of {totalPages}</span>
                                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <style>{`
                .review-dashboard-wrapper {
                    background-color: #f8fafc;
                    min-height: 100vh;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    padding-bottom: 4rem;
                }

                .top-nav-bar {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 1.5rem 2rem 0;
                }

                .back-navigation-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: none;
                    border: none;
                    color: #64748b;
                    font-weight: 600;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .back-navigation-btn:hover { color: #2563eb; transform: translateX(-4px); }

                .review-container {
                    max-width: 1200px;
                    margin: 2rem auto;
                    padding: 0 2rem;
                }

                .review-header-flex {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 2rem;
                    gap: 2rem;
                }

                @media (max-width: 768px) {
                    .review-header-flex { flex-direction: column; align-items: flex-start; }
                }

                .header-with-icon { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
                .title-icon-wrapper {
                    background: #2563eb;
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
                }
                .header-with-icon h1 { font-size: 1.75rem; font-weight: 800; color: #1e293b; margin: 0; }
                .brand-badge { font-size: 0.75rem; vertical-align: middle; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 6px; margin-left: 8px; }

                .subtitle-muted { color: #64748b; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; margin: 0; }

                .search-input-wrapper {
                    position: relative;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    width: 320px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .search-input-wrapper input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: none;
                    border-radius: 12px;
                    outline: none;
                    font-size: 0.9rem;
                }

                .table-card {
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                }

                .table-responsive-wrapper { overflow-x: auto; }

                .modern-review-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }

                .modern-review-table thead th {
                    background: #f8fafc;
                    padding: 1.25rem 1.5rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid #e2e8f0;
                }

                .modern-review-table tbody tr { transition: background 0.2s; }
                .modern-review-table tbody tr:hover { background: #f1f5f9; }
                .modern-review-table tbody td { padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }

                .student-col { display: flex; align-items: center; gap: 1rem; }
                .avatar-placeholder { width: 32px; height: 32px; border-radius: 50%; background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; }
                .name-bold { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
                .project-title-col { font-weight: 500; color: #475569; }

                .year-pill {
                    background: #fef3c7;
                    color: #92400e;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 9999px;
                }

                .doc-link-group { display: flex; gap: 0.5rem; }
                .doc-preview-link {
                    text-decoration: none;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 6px 12px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                .doc-preview-link.srs { background: #eff6ff; color: #2563eb; }
                .doc-preview-link.sdd { background: #faf5ff; color: #9333ea; }
                .doc-preview-link:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }

                .approve-action-btn {
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 9999px;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
                }
                .approve-action-btn:hover { background: #059669; transform: scale(1.05); }

                .text-right { text-align: right; }

                .pagination-footer { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-top: 1px solid #e2e8f0; }
                .pagination-footer p { margin: 0; color: #64748b; font-size: 0.85rem; }
                .pagination-btns { display: flex; align-items: center; gap: 1rem; }
                .pagination-btns button { background: white; border: 1px solid #e2e8f0; padding: 6px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
                .pagination-btns button:disabled { opacity: 0.5; cursor: not-allowed; }
                .pagination-btns span { font-size: 0.85rem; color: #475569; font-weight: 500; }

                .empty-state-view { padding: 5rem 2rem; text-align: center; }
                .empty-illustration { font-size: 4rem; margin-bottom: 1.5rem; }
                .empty-state-view h3 { font-size: 1.5rem; color: #1e293b; margin-bottom: 0.5rem; }
                .empty-state-view p { color: #64748b; }

                /* Skeleton Loading */
                .skeleton-row { height: 60px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: loading 1.5s infinite; margin-bottom: 1px; }
                @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            `}</style>
        </div>
    );
};

export default TeacherReviewPage;
