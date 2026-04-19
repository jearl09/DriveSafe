import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

interface BackupRecord {
    id: number;
    filename: string;
    date: string;
    status: string;
    local_path: string;
}

const BackupHistoryPage = () => {
    const [history, setHistory] = useState<BackupRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await axios.get('http://localhost:5000/history', { withCredentials: true });
                setHistory(response.data);
            } catch (err) {
                console.error("Failed to load history");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const filteredHistory = history.filter(h => 
        h.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container" style={{ marginTop: '50px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>Archive History & Repository</h2>
                    <p style={{ color: '#64748b', marginTop: '5px' }}>Persistent digital log of all successfully archived projects.</p>
                </div>
                <button onClick={() => window.location.hash = "dashboard"} className="btn btn-header">Back to Dashboard</button>
            </div>

            <div className="dashboard-card">
                <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
                    <input 
                        type="text" 
                        placeholder="Search by project name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-input"
                        style={{ maxWidth: '400px' }}
                    />
                </div>

                {loading ? (
                    <div style={{ padding: '50px', textAlign: 'center' }}>Loading records...</div>
                ) : filteredHistory.length === 0 ? (
                    <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>No archived records found.</div>
                ) : (
                    <table className="files-table">
                        <thead>
                            <tr>
                                <th>Project & Document</th>
                                <th>Archive Date</th>
                                <th>Status</th>
                                <th>Local Path</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map(h => (
                                <tr key={h.id}>
                                    <td style={{ fontWeight: 600 }}>{h.filename}</td>
                                    <td style={{ color: '#64748b' }}>{h.date}</td>
                                    <td>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                                            background: '#dcfce7', color: '#166534'
                                        }}>
                                            {h.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {h.local_path}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default BackupHistoryPage;
