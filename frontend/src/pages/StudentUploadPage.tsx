import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

const StudentUploadPage = () => {
    const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
    const [projectName, setProjectName] = useState('');
    const [srsLink, setSrsLink] = useState('');
    const [sddLink, setSddLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchMyFiles = async () => {
            try {
                const response = await axios.get('http://localhost:5000/drive/files', { withCredentials: true });
                setDriveFiles(response.data.files || []);
            } catch (err) {
                console.error("Failed to load drive files");
            }
        };
        fetchMyFiles();
    }, []);

    const selectFile = (fileId: string, type: 'SRS' | 'SDD') => {
        const link = `https://drive.google.com/file/d/${fileId}/view`;
        if (type === 'SRS') setSrsLink(link);
        else setSddLink(link);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName || (!srsLink && !sddLink)) {
            alert("Please provide a project name and at least one document.");
            return;
        }

        setLoading(true);
        try {
            await axios.post('http://localhost:5000/api/upload', {
                project_name: projectName,
                srs_link: srsLink,
                sdd_link: sddLink
            }, { withCredentials: true });
            
            setMessage("Submission successful! Pending teacher review.");
            setProjectName(''); setSrsLink(''); setSddLink('');
        } catch (error: any) {
            setMessage("Submission failed: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ marginTop: '50px', display: 'flex', gap: '40px' }}>
            {/* LEFT: FORM */}
            <div style={{ flex: 1 }}>
                <h2>Submit Project</h2>
                <form onSubmit={handleSubmit} className="dashboard-card" style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label>Project Title:</label>
                        <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="form-input" required />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label>SRS Link:</label>
                        <input type="text" value={srsLink} readOnly className="form-input" style={{ background: '#f1f5f9' }} placeholder="Select from your Drive ->" />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label>SDD Link:</label>
                        <input type="text" value={sddLink} readOnly className="form-input" style={{ background: '#f1f5f9' }} placeholder="Select from your Drive ->" />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>Submit for Review</button>
                </form>
                {message && <p style={{ marginTop: '10px', color: '#10b981' }}>{message}</p>}
            </div>

            {/* RIGHT: DRIVE PICKER */}
            <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '15px', background: '#2563eb', color: '#fff', fontWeight: 'bold' }}>
                    Select Files from Your Google Drive
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {driveFiles.map(file => (
                        <div key={file.id} style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>📄 {file.name}</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button onClick={() => selectFile(file.id, 'SRS')} className="btn btn-header" style={{ fontSize: '10px', padding: '4px 8px' }}>Set SRS</button>
                                <button onClick={() => selectFile(file.id, 'SDD')} className="btn btn-header" style={{ fontSize: '10px', padding: '4px 8px' }}>Set SDD</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudentUploadPage;
