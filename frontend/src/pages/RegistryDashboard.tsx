import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  Search
} from 'lucide-react';

interface Project {
    row_index: number;
    project_id: string;
    project_title: string;
    srs_link: string;
    sdd_link: string;
    status: string;
    academic_year: string;
    latest_version?: number;
}

interface Workbook {
    id: string;
    name: string;
}

const RegistryDashboard: React.FC = () => {
    const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
    const [selectedWorkbookId, setSelectedWorkbookId] = useState<string>('');
    const [years, setYears] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [validationResults, setValidationResults] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<{ text: string, type: 'info' | 'error' | 'success' } | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    useEffect(() => {
        fetchWorkbooks();
    }, []);

    useEffect(() => {
        if (selectedWorkbookId) {
            fetchYears(selectedWorkbookId);
        } else {
            setYears([]);
            setSelectedYear('');
            setProjects([]);
        }
    }, [selectedWorkbookId]);

    useEffect(() => {
        if (selectedYear && selectedWorkbookId) {
            fetchProjects(selectedYear, selectedWorkbookId);
        }
    }, [selectedYear]);

    const fetchWorkbooks = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/registry/list-sheets`, { withCredentials: true });
            setWorkbooks(res.data);
            if (res.data.length > 0) {
                setSelectedWorkbookId(res.data[0].id);
            }
        } catch (err) {
            setMessage({ text: "Failed to load Google Sheets from Drive.", type: 'error' });
        }
    };

    const fetchYears = async (workbookId: string) => {
        try {
            const res = await axios.get(`http://localhost:5000/api/registry/years?sheet_id=${workbookId}`, { withCredentials: true });
            setYears(res.data);
            if (res.data.length > 0) setSelectedYear(res.data[0]);
            else setSelectedYear('');
        } catch (err) {
            setMessage({ text: "Failed to load years from the selected sheet.", type: 'error' });
            setYears([]);
            setSelectedYear('');
        }
    };

    const fetchProjects = async (year: string, workbookId: string) => {
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/registry/projects?year=${year}&sheet_id=${workbookId}`, { withCredentials: true });
            setProjects(res.data);
            setSelectedRows([]);
            setValidationResults({});
        } catch (err) {
            setMessage({ text: "Failed to load projects from sheet.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRow = (rowIndex: number) => {
        setSelectedRows(prev => prev.includes(rowIndex) ? prev.filter(r => r !== rowIndex) : [...prev, rowIndex]);
    };

    const handleSelectAll = () => {
        setSelectedRows(selectedRows.length === projects.length ? [] : projects.map(p => p.row_index));
    };

    const validateLinks = async () => {
        const linksToValidate = projects.flatMap(p => [p.srs_link, p.sdd_link]).filter(l => l);
        if (linksToValidate.length === 0) return;
        setLoading(true);
        try {
            const res = await axios.post(`http://localhost:5000/api/registry/validate`, { 
                links: linksToValidate,
                sheet_id: selectedWorkbookId 
            }, { withCredentials: true });
            setValidationResults(res.data);
        } catch (err) {
            setMessage({ text: "Validation failed.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async () => {
        const selectedProjects = projects.filter(p => selectedRows.includes(p.row_index));
        if (selectedProjects.length === 0) return;
        setIsProcessing(true);
        try {
            await axios.post(`http://localhost:5000/api/registry/archive`, { 
                projects: selectedProjects,
                sheet_id: selectedWorkbookId
            }, { withCredentials: true });
            setMessage({ text: "Archival sequence initiated. Tracking progress in Sheets.", type: 'success' });
            setTimeout(() => fetchProjects(selectedYear, selectedWorkbookId), 3000);
        } catch (err) {
            setMessage({ text: "Archival request failed.", type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetStatus = async (project: Project) => {
        if (!window.confirm(`Reset status for "${project.project_title}" back to Pending?`)) return;
        try {
            await axios.post(`http://localhost:5000/api/registry/reset`, { project }, { withCredentials: true });
            setMessage({ text: "Status reset successfully.", type: 'success' });
            fetchProjects(selectedYear, selectedWorkbookId);
        } catch (err) {
            setMessage({ text: "Failed to reset status.", type: 'error' });
        }
    };

    const getStatusBadge = (project: Project) => {
        const base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider";
        const status = project.status.toLowerCase();
        
        const isNotPending = status !== 'pending';

        return (
            <div className="flex items-center gap-4">
                {status === 'pending' && <span className={`${base} bg-blue-50 text-blue-600`}>Pending</span>}
                {status === 'archived' && (
                    <div className="flex items-center gap-2">
                        <span className={`${base} bg-emerald-50 text-emerald-600`}>Archived</span>
                        {project.latest_version && project.latest_version > 1 && (
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                V{project.latest_version}
                            </span>
                        )}
                    </div>
                )}
                {status === 'duplicate' && <span className={`${base} bg-amber-50 text-amber-600`}>Duplicate</span>}
                {status === 'failed' && <span className={`${base} bg-red-50 text-red-600`}>Action Required</span>}
                {status !== 'pending' && status !== 'archived' && status !== 'duplicate' && status !== 'failed' && (
                    <span className={`${base} bg-slate-100 text-slate-500`}>{project.status}</span>
                )}

                {isNotPending && (
                    <button 
                        onClick={() => handleResetStatus(project)}
                        className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-tighter"
                        title="Change status back to Pending in Sheets"
                    >
                        Reset Status
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
            {/* Edge-to-edge Toolbar */}
            <div className="w-full bg-white border-b border-slate-200">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => window.location.hash = "dashboard"}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> <span>Back</span>
                        </button>
                        <div className="h-6 w-[1px] bg-slate-200"></div>
                        <h1 className="text-lg font-bold text-slate-900">Registry Pipeline</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Workbook:</label>
                        <select 
                            value={selectedWorkbookId} 
                            onChange={(e) => setSelectedWorkbookId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 outline-none font-semibold"
                        >
                            {workbooks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Sheet:</label>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 outline-none font-semibold"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 w-full max-w-[1400px] mx-auto p-6 space-y-6">
                
                {/* Status Messages */}
                {message && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                        message.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 
                        message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                        'bg-blue-50 border-blue-100 text-blue-700'
                    }`}>
                        <div className="flex items-center gap-3">
                            {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                            <span className="text-sm font-medium">{message.text}</span>
                        </div>
                        <button onClick={() => setMessage(null)} className="text-xs font-bold uppercase opacity-50 hover:opacity-100">Dismiss</button>
                    </div>
                )}

                {/* Table Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={validateLinks} 
                            disabled={loading || projects.length === 0}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Validate Links
                        </button>
                        <button 
                            onClick={handleArchive} 
                            disabled={isProcessing || selectedRows.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" /> Archive Selected ({selectedRows.length})
                        </button>
                    </div>
                    
                    <button 
                        onClick={() => fetchProjects(selectedYear, selectedWorkbookId)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Refresh List"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Modern Table Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 w-12">
                                        <div className="flex items-center justify-center">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedRows.length === projects.length && projects.length > 0} 
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Project ID</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Project Title</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">SRS Doc</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">SDD Doc</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && projects.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <RefreshCw className="w-8 h-8 text-blue-200 animate-spin" />
                                                <p className="text-slate-400 text-sm font-medium">Reading Registry Data...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : projects.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Search className="w-8 h-8 text-slate-200" />
                                                <p className="text-slate-400 text-sm font-medium">No projects found in this sheet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : projects.map((p) => (
                                    <tr key={p.row_index} className={`hover:bg-slate-50/50 transition-colors group ${selectedRows.includes(p.row_index) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedRows.includes(p.row_index)} 
                                                    onChange={() => handleSelectRow(p.row_index)}
                                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-500 uppercase tracking-tighter">
                                            {p.project_id || "N/A"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{p.project_title}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {p.srs_link ? (
                                                <div className="flex flex-col gap-1">
                                                    <a href={p.srs_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1.5 transition-colors">
                                                        <ExternalLink className="w-3 h-3" /> View Source
                                                    </a>
                                                    {validationResults[p.srs_link] && (
                                                        <span className={`text-[10px] font-medium ${validationResults[p.srs_link] === 'Accessible' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {validationResults[p.srs_link]}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span className="text-slate-300 text-[10px] font-bold">MISSING</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {p.sdd_link ? (
                                                <div className="flex flex-col gap-1">
                                                    <a href={p.sdd_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1.5 transition-colors">
                                                        <ExternalLink className="w-3 h-3" /> View Source
                                                    </a>
                                                    {validationResults[p.sdd_link] && (
                                                        <span className={`text-[10px] font-medium ${validationResults[p.sdd_link] === 'Accessible' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {validationResults[p.sdd_link]}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span className="text-slate-300 text-[10px] font-bold">MISSING</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(p)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RegistryDashboard;
