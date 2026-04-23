import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";

interface LedgerRecord {
    id: number;
    project_id: string;
    project_title: string;
    academic_year: string;
    status: string;
    srs_path: string;
    sds_path: string;
    srs_hash: string;
    sds_hash: string;
    error: string;
    archived_at: string;
}

const BackupHistoryPage = () => {
    const [records, setRecords] = useState<LedgerRecord[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchLedger();
    }, []);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get("http://localhost:5000/api/registry/ledger", { withCredentials: true });
            setRecords(res.data);
        } catch (err) {
            console.error("Failed to fetch ledger", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <h1 style={{ margin: 0, color: '#1e293b' }}>Archival Ledger</h1>
                        <p style={{ color: '#64748b', marginTop: '5px' }}>Master record of all local archives and cryptographic hashes.</p>
                    </div>
                    <button onClick={() => window.location.hash = 'dashboard'} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Back to Admin
                    </button>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '15px', color: '#475569' }}>Project</th>
                                <th style={{ padding: '15px', color: '#475569' }}>Year</th>
                                <th style={{ padding: '15px', color: '#475569' }}>Status</th>
                                <th style={{ padding: '15px', color: '#475569' }}>Local Paths</th>
                                <th style={{ padding: '15px', color: '#475569' }}>SHA-256 Hashes</th>
                                <th style={{ padding: '15px', color: '#475569' }}>Archived At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>Loading master ledger...</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>No archival records found.</td></tr>
                            ) : records.map((r) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{r.project_title}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {r.project_id}</div>
                                    </td>
                                    <td style={{ padding: '15px', color: '#475569' }}>{r.academic_year}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold',
                                            backgroundColor: r.status === 'archived' ? '#dcfce7' : '#fee2e2',
                                            color: r.status === 'archived' ? '#166534' : '#991b1b'
                                        }}>
                                            {r.status.toUpperCase()}
                                        </span>
                                        {r.error && <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '5px', maxWidth: '150px' }}>{r.error}</div>}
                                    </td>
                                    <td style={{ padding: '15px', fontSize: '0.7rem', color: '#64748b', maxWidth: '250px' }}>
                                        <div style={{ marginBottom: '5px' }}><strong>SRS:</strong> {r.srs_path || 'N/A'}</div>
                                        <div><strong>SDD:</strong> {r.sdd_path || 'N/A'}</div>
                                    </td>
                                    <td style={{ padding: '15px', fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace', maxWidth: '200px' }}>
                                        <div style={{ marginBottom: '5px' }}><strong>SRS:</strong> {r.srs_hash ? r.srs_hash.substring(0, 16) + '...' : 'N/A'}</div>
                                        <div><strong>SDD:</strong> {r.sdd_hash ? r.sdd_hash.substring(0, 16) + '...' : 'N/A'}</div>
                                    </td>
                                    <td style={{ padding: '15px', color: '#64748b', fontSize: '0.85rem' }}>{r.archived_at || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BackupHistoryPage;
