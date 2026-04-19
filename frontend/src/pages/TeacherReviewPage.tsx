import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

interface PendingProject {
    id: number;
    student_name: string;
    project_name: string;
    srs_link: string;
    sdd_link: string;
    date: string;
}

const TeacherReviewPage = () => {
    const [projects, setProjects] = useState<PendingProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPending = async () => {
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
            setProjects([]);
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
            alert("Project approved! Files are being downloaded and archived locally.");
            setProjects(projects.filter(p => p.id !== id));
        } catch (err: any) {
            alert("Approval failed: " + (err.response?.data?.error || err.message));
        }
    };

    if (loading) return <div className="container">Loading reviews...</div>;

    return (
        <div className="container" style={{ marginTop: '50px' }}>
            <h2>Teacher Review Dashboard (IntelliTrack)</h2>
            <p>Verify the submitted Google Drive/PDF links before approving for local archival.</p>
            
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            {projects.length === 0 ? (
                <p>No pending submissions to review.</p>
            ) : (
                <table className="files-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Project Title</th>
                            <th>Documents to Review</th>
                            <th>Date Submitted</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map(p => (
                            <tr key={p.id}>
                                <td>{p.student_name}</td>
                                <td>{p.project_name}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {p.srs_link && (
                                            <a href={p.srs_link} target="_blank" rel="noreferrer" className="btn btn-header" style={{ fontSize: '12px', padding: '5px 10px' }}>
                                                📄 Review SRS
                                            </a>
                                        )}
                                        {p.sdd_link && (
                                            <a href={p.sdd_link} target="_blank" rel="noreferrer" className="btn btn-header" style={{ fontSize: '12px', padding: '5px 10px' }}>
                                                📄 Review SDD
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td>{p.date}</td>
                                <td>
                                    <button className="btn btn-primary" onClick={() => handleApprove(p.id)}>✅ Approve & Download</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <div style={{ marginTop: '20px' }}>
                <a href="#dashboard">Back to Dashboard</a>
            </div>
        </div>
    );
};

export default TeacherReviewPage;
