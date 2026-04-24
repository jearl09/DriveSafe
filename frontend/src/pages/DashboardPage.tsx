import { useEffect, useState } from "react";
import axios from "axios";
import { 
  LayoutDashboard, 
  History, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  Zap, 
  Database, 
  RefreshCw,
  Activity,
  FileCheck,
  Lock,
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
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Navbar */}
      <nav className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">DriveSafe</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 leading-none">{user?.name}</p>
              <p className="text-xs text-slate-500 mt-1">{user?.email}</p>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto p-6 space-y-8">
        
        {/* Header & Status Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">System Overview</h2>
            <p className="text-slate-500 text-sm">Automated archival status and management.</p>
          </div>
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-1.5 rounded-full shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sync: {stats?.last_sync.split(' ')[1]}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Cloud Active</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Import</p>
              <p className="text-3xl font-black text-slate-900">{stats?.pending_count}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
              <Zap className="w-7 h-7" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Archived Total</p>
              <p className="text-3xl font-black text-slate-900">{stats?.archived_count}</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
              <FileCheck className="w-7 h-7" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cloud Auth Status</p>
              <p className={`text-xl font-bold ${stats?.service_account_configured ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats?.service_account_configured ? "Operational" : "Check Config"}
              </p>
            </div>
            <div className={`p-4 rounded-2xl ${stats?.service_account_configured ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          
          {/* Card 1 */}
          <div className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Registry Dashboard</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Manage the archival pipeline. Load academic years, validate drive links, and execute local versioning.
                </p>
              </div>
              <button 
                onClick={() => window.location.hash = "registry-dashboard"}
                className="w-full py-4 px-6 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors group-hover:shadow-lg"
              >
                Open Registry <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <History className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Archival Ledger</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  View the master history of all archived projects, cryptographic hashes, and server storage paths.
                </p>
              </div>
              <button 
                onClick={() => window.location.hash = "backup-history"}
                className="w-full py-4 px-6 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors group-hover:shadow-lg"
              >
                View Ledger <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 3 (Locked) */}
          <div className="bg-slate-100/50 rounded-3xl border border-slate-200 border-dashed overflow-hidden relative">
            <div className="p-8 space-y-6 opacity-60">
              <div className="w-12 h-12 bg-slate-300 rounded-xl flex items-center justify-center text-slate-600">
                <Settings className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">System Config</h3>
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Configure sheet IDs, service account keys, and local storage parameters for the archival engine.
                </p>
              </div>
              <button 
                disabled
                className="w-full py-4 px-6 bg-slate-200 text-slate-500 rounded-xl font-bold cursor-not-allowed flex items-center justify-center gap-2"
              >
                Configuration Locked
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="w-full max-w-[1400px] mx-auto px-6 py-10 border-t border-slate-200 mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-xs font-medium">© 2026 DriveSafe • Advanced Registrar Archival Tool</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-400 hover:text-blue-600 text-[10px] font-bold uppercase tracking-widest">Compliance</a>
            <a href="#" className="text-slate-400 hover:text-blue-600 text-[10px] font-bold uppercase tracking-widest">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardPage;
