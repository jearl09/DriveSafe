import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Download, 
  Eye, 
  Copy, 
  Check,
  Calendar,
  Hash,
  Archive,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  FolderOpen
} from 'lucide-react';

// --- Interfaces ---
interface FileRecord {
    type: 'SRS' | 'SDD' | 'SPMP' | 'STD' | 'RI';
    path: string;
    hash: string;
    label: string;
}

interface ProjectRecord {
    id: number;
    project_id: string;
    project_title: string;
    academic_year: string;
    status: string;
    version: number;
    archived_at: string;
    error?: string;
    files: FileRecord[];
}

const ArchivalLedgerPage: React.FC = () => {
    const [rawRecords, setRawRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
    const [copiedHash, setCopiedHash] = useState<string | null>(null);

    // --- API Fetching ---
    useEffect(() => {
        const fetchLedger = async () => {
            try {
                // Using your existing endpoint
                const res = await axios.get("/api/registry/ledger", { withCredentials: true });
                setRawRecords(res.data);
            } catch (err) {
                console.error("Failed to fetch ledger", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLedger();
    }, []);

    // --- Data Transformation ---
    const projects: ProjectRecord[] = useMemo(() => {
        return rawRecords.map(r => ({
            id: r.id,
            project_id: r.project_id,
            project_title: r.project_title,
            academic_year: r.academic_year,
            status: r.status,
            version: r.version,
            archived_at: r.archived_at,
            error: r.error,
            files: [
                { type: 'SRS', path: r.srs_path, hash: r.srs_hash, label: 'Software Requirements Specification' },
                { type: 'SDD', path: r.sdd_path, hash: r.sdd_hash, label: 'Software Design Document' },
                { type: 'SPMP', path: r.spmp_path, hash: r.spmp_hash, label: 'Software Project Management Plan' },
                { type: 'STD', path: r.std_path, hash: r.std_hash, label: 'Software Test Document' },
                { type: 'RI', path: r.ri_path, hash: r.ri_hash, label: 'Repository Information' },
            ].filter(f => f.path) as FileRecord[] // Only show files that actually exist
        }));
    }, [rawRecords]);

    // --- Filtering Logic ---
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = 
                p.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.project_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.academic_year.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();
            
            return matchesSearch && matchesStatus;
        });
    }, [projects, searchQuery, statusFilter]);

    // --- Handlers ---
    const toggleProject = (id: number) => {
        const newSet = new Set(expandedProjects);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedProjects(newSet);
    };

    const copyToClipboard = (hash: string) => {
        navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 2000);
    };

    const handleView = (ledgerId: number, type: string) => {
        window.open(`/api/registry/download/${ledgerId}/${type.toLowerCase()}?preview=1`, '_blank');
    };

    const handleDownload = (ledgerId: number, type: string) => {
        window.location.href = `/api/registry/download/${ledgerId}/${type.toLowerCase()}`;
    };

    // --- Helper Components ---
    const StatusBadge = ({ status }: { status: string }) => {
        const styles: any = {
            archived: "bg-emerald-50 text-emerald-700 border-emerald-100",
            failed: "bg-red-50 text-red-700 border-red-100",
            pending: "bg-amber-50 text-amber-700 border-amber-100"
        };
        const currentStyle = styles[status.toLowerCase()] || "bg-slate-50 text-slate-700 border-slate-100";
        
        return (
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentStyle}`}>
                {status}
            </span>
        );
    };

    const FileIcon = ({ type }: { type: string }) => {
        switch(type) {
            case 'SRS': return <FileText className="w-4 h-4 text-blue-500" />;
            case 'SDD': return <Archive className="w-4 h-4 text-purple-500" />;
            case 'SPMP': return <Calendar className="w-4 h-4 text-emerald-500" />;
            case 'STD': return <Check className="w-4 h-4 text-orange-500" />;
            default: return <Hash className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100 antialiased">
            {/* Navigation Header */}
            <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => window.location.hash = 'dashboard'}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">Archival Ledger</h1>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Master Digital Repository</p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-bold">System Synchronized</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                
                {/* Search & Filters Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search by project, ID, or year..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="all">All Statuses</option>
                            <option value="archived">Archived</option>
                            <option value="failed">Failed</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>

                {/* Ledger Content */}
                <div className="space-y-4">
                    {loading ? (
                        // Skeleton Loader
                        [1, 2, 3].map(i => (
                            <div key={i} className="h-24 w-full bg-white border border-slate-200 rounded-2xl animate-pulse" />
                        ))
                    ) : filteredProjects.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                            <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-900">No records found</h3>
                            <p className="text-slate-500 text-sm">Try adjusting your filters or search query.</p>
                        </div>
                    ) : (
                        filteredProjects.map((project) => (
                            <div 
                                key={project.id}
                                className={`bg-white border transition-all duration-300 overflow-hidden ${
                                    expandedProjects.has(project.id) 
                                    ? 'rounded-3xl border-blue-200 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/5' 
                                    : 'rounded-2xl border-slate-200 shadow-sm hover:border-slate-300'
                                }`}
                            >
                                {/* Project Card Header */}
                                <div 
                                    onClick={() => toggleProject(project.id)}
                                    className="p-5 flex items-center justify-between cursor-pointer group"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`p-3 rounded-2xl transition-colors ${
                                            expandedProjects.has(project.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                                        }`}>
                                            <FolderOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h2 className="font-bold text-slate-900">{project.project_title}</h2>
                                                {project.version > 1 && (
                                                    <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-blue-100">
                                                        V{project.version}
                                                    </span>
                                                )}
                                                <StatusBadge status={project.status} />
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {project.project_id}</span>
                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {project.academic_year}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="hidden lg:block text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Archived On</p>
                                            <p className="text-xs font-bold text-slate-700">{project.archived_at}</p>
                                        </div>
                                        <div className={`p-2 rounded-full transition-transform duration-300 ${expandedProjects.has(project.id) ? 'rotate-180 bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                                            <ChevronDown className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {expandedProjects.has(project.id) && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-6">
                                        {project.error && (
                                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Archival Error Detected</p>
                                                    <p className="text-sm text-red-600 font-medium">{project.error}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                <div className="col-span-4">Document Type</div>
                                                <div className="col-span-4">Fingerprint (SHA-256)</div>
                                                <div className="col-span-4 text-right">Actions</div>
                                            </div>
                                            
                                            {project.files.map((file) => (
                                                <div 
                                                    key={file.type}
                                                    className="grid grid-cols-12 items-center bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all group/row"
                                                >
                                                    <div className="col-span-4 flex items-center gap-3">
                                                        <div className="p-2 bg-slate-50 rounded-lg group-hover/row:bg-blue-50 transition-colors">
                                                            <FileIcon type={file.type} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900 uppercase tracking-tighter">{file.type}</p>
                                                            <p className="text-[10px] font-medium text-slate-500 line-clamp-1">{file.label}</p>
                                                        </div>
                                                    </div>

                                                    <div className="col-span-4 flex items-center gap-2">
                                                        <code className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded font-mono border border-slate-100">
                                                            {file.hash ? `${file.hash.substring(0, 12)}...` : 'NO_HASH'}
                                                        </code>
                                                        {file.hash && (
                                                            <button 
                                                                onClick={() => copyToClipboard(file.hash)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all relative"
                                                                title="Copy SHA-256"
                                                            >
                                                                {copiedHash === file.hash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                                {copiedHash === file.hash && (
                                                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-xl">Copied!</span>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="col-span-4 flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleView(project.id, file.type)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                                                        >
                                                            <Eye className="w-3 h-3" /> View PDF
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDownload(project.id, file.type)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                                        >
                                                            <Download className="w-3 h-3" /> Download
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default ArchivalLedgerPage;
