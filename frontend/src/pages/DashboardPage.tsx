import { useEffect, useState } from "react";
import axios from "axios";
import { 
  LayoutDashboard, 
  History, 
  LogOut, 
  ShieldCheck, 
  Zap, 
  Database, 
  RefreshCw,
  Activity,
  FileCheck,
  ChevronRight
} from "lucide-react";

interface UserInfo {
  email: string;
  name: string;
  role: string;
}

interface DashboardStats {
  archived_count: number;
  pending_count: number;
  service_account_configured: boolean;
  last_sync: string;
}

const DashboardPage: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, statsRes] = await Promise.all([
          axios.get('/api/user-info', { withCredentials: true }),
          axios.get('/api/registry/stats', { withCredentials: true })
        ]);
        setUser(userRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error("Dashboard Fetch Failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.hash = "";
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col antialiased">
      {/* Navbar */}
      <nav className="w-full bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">DriveSafe</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">{user?.name}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{user?.role} Access</p>
            </div>
            <div className="h-8 w-[1px] bg-slate-100 mx-2 hidden sm:block"></div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1500px] mx-auto px-10 py-10 space-y-12">
        
        {/* Header & Status Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">System Console</h2>
            <p className="text-slate-500 font-medium text-lg">Monitoring and managing the registrar's digital archival integrity.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Last Sync: {stats?.last_sync.split(' ')[1]}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span className="text-[11px] font-bold text-white uppercase tracking-widest">Live Status</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-500 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ready for Import</p>
              <p className="text-5xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{stats?.pending_count}</p>
            </div>
            <div className="p-6 bg-blue-50 rounded-[2rem] text-blue-600 group-hover:scale-110 transition-transform">
              <Zap className="w-8 h-8 fill-current" />
            </div>
          </div>

          <div className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-500 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Total Vault Archives</p>
              <p className="text-5xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{stats?.archived_count}</p>
            </div>
            <div className="p-6 bg-indigo-50 rounded-[2rem] text-indigo-600 group-hover:scale-110 transition-transform">
              <FileCheck className="w-8 h-8" />
            </div>
          </div>

          <div className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-500 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Cloud Auth Protocol</p>
              <p className={`text-2xl font-black uppercase tracking-tighter ${stats?.service_account_configured ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats?.service_account_configured ? "Secured" : "Config Required"}
              </p>
            </div>
            <div className={`p-6 rounded-[2rem] group-hover:scale-110 transition-transform ${stats?.service_account_configured ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Primary Action Suite */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          <div className="group relative bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm hover:shadow-2xl transition-all duration-700 overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <LayoutDashboard className="w-64 h-64 -mr-20 -mt-20 rotate-12" />
            </div>
            
            <div className="relative space-y-8">
              <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
                <LayoutDashboard className="w-8 h-8" />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Registry Pipeline</h3>
                <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-md">
                  Execute the primary archival sequence. Manage sheet IDs, validate student links, and synchronize local storage.
                </p>
              </div>
              <button 
                onClick={() => window.location.hash = "registry-dashboard"}
                className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all hover:gap-5 hover:shadow-2xl active:scale-95"
              >
                Launch Pipeline <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="group relative bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm hover:shadow-2xl transition-all duration-700 overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <History className="w-64 h-64 -mr-20 -mt-20 -rotate-12" />
            </div>

            <div className="relative space-y-8">
              <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 group-hover:scale-110 transition-transform duration-500">
                <History className="w-8 h-8" />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Archival Ledger</h3>
                <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-md">
                  The master historical record. Audit cryptographic signatures, verify version history, and access local binaries.
                </p>
              </div>
              <button 
                onClick={() => window.location.hash = "backup-history"}
                className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all hover:gap-5 hover:shadow-2xl active:scale-95"
              >
                Access Ledger <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="w-full px-8 py-12 border-t border-slate-50 mt-12 bg-slate-50/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-200 rounded-lg">
                <Database className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">DriveSafe Internal Engine v2.0</p>
          </div>
          <div className="flex items-center gap-10">
            <a href="#" className="text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] transition-colors">Compliance</a>
            <a href="#" className="text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] transition-colors">Data Privacy</a>
            <a href="#" className="text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] transition-colors">Audit Logs</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardPage;
