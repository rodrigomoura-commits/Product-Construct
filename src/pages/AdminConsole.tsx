import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Shield, Boxes, Brain, Bot, 
  Settings as SettingsIcon, History, Plug, Loader2, ChevronRight,
  LogOut, Bell, Search, Menu, X, CheckCircle2, AlertCircle, ArrowLeft,
  Activity, Clock, Database as DatabaseIcon, Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Lazy load sections
import AdminDashboardSection from './admin/DashboardSection';
import UsersAdminSection from './admin/UsersSection';
import PermissionsAdminSection from './admin/PermissionsSection';
import ProductsAdminSection from './admin/ProductsSection';
import MindflowAdminSection from './admin/MindflowSection';
import ScheduleAdminSection from './admin/ScheduleSection';
import AgentsAdminSection from './admin/AgentsSection';
import SettingsAdminSection from './admin/SettingsSection';
import AuditAdminSection from './admin/AuditSection';
import IntegrationsAdminSection from './admin/IntegrationsSection';
import DatabaseAdminSection from './admin/DatabaseSection';
import TonaPersonalityAdminSection from './admin/TonaPersonalitySection';

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Usuários", icon: Users },
  { id: "permissions", label: "Papéis e Permissões", icon: Shield },
  { id: "products", label: "Produtos", icon: Boxes },
  { id: "mindflow", label: "Mindflow", icon: Activity },
  { id: "tona-personality", label: "Persona Tona", icon: Sparkles },
  { id: "database", label: "Banco de Dados", icon: DatabaseIcon },
  { id: "schedule", label: "Agendador", icon: Clock },
  { id: "agents", label: "Agent Studio", icon: Bot },
  { id: "settings", label: "Configurações", icon: SettingsIcon },
  { id: "audit", label: "Auditoria", icon: History },
  { id: "integrations", label: "Integrações", icon: Plug },
] as const;

type SectionId = typeof ADMIN_NAV[number]['id'] | 'memory';

export default function AdminConsole() {
  const { user, profile, adminCtx, loading: authLoading, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeSection = (searchParams.get('section') as SectionId) || 'dashboard';
  const from = searchParams.get('from');

  useEffect(() => {
    if (activeSection === 'memory') {
      setSearchParams({ section: 'mindflow' });
    }
  }, [activeSection, setSearchParams]);

  useEffect(() => {
    if (!authLoading && !adminCtx?.isAdmin) {
      navigate('/products');
    }
  }, [adminCtx, authLoading, navigate]);

  const handleBackFromAdmin = () => {
    const fallback = "/products";
    if (from && from.startsWith("/") && !from.startsWith("/admin")) {
      navigate(from);
      return;
    }
    navigate(fallback);
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-zinc-300 animate-spin" />
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <AdminDashboardSection />;
      case 'users': return <UsersAdminSection />;
      case 'permissions': return <PermissionsAdminSection />;
      case 'products': return <ProductsAdminSection />;
      case 'mindflow': return <MindflowAdminSection ctx={adminCtx!} />;
      case 'tona-personality': return <TonaPersonalityAdminSection />;
      case 'memory': return <MindflowAdminSection ctx={adminCtx!} />; // Safe fallback/redirect
      case 'database': return <DatabaseAdminSection />;
      case 'schedule': return <ScheduleAdminSection ctx={adminCtx!} />;
      case 'agents': return <AgentsAdminSection />;
      case 'settings': return <SettingsAdminSection />;
      case 'audit': return <AuditAdminSection />;
      case 'integrations': return <IntegrationsAdminSection />;
      default: return <AdminDashboardSection />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-slate-900 flex flex-col z-50 border-r border-slate-800"
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/20">
               <Shield className="text-white w-6 h-6" />
             </div>
             {isSidebarOpen && (
               <div className="flex flex-col">
                 <span className="font-bold text-white leading-none tracking-tight">Tona<span className="text-indigo-400">Core</span></span>
                 <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black mt-1">PRODUCT CONSTRUCTOR</span>
               </div>
             )}
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {ADMIN_NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setSearchParams({ section: item.id })}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                activeSection === item.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-active:scale-90", activeSection === item.id ? "text-white" : "text-slate-500 group-hover:text-white")} />
              {isSidebarOpen && <span className="font-bold text-sm tracking-tight">{item.label}</span>}
              {!isSidebarOpen && activeSection === item.id && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-l-full mr-[-16px]" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          {isSidebarOpen && (
            <button 
              onClick={handleBackFromAdmin}
              className="w-full flex items-center gap-3 px-3 py-3 text-indigo-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all font-bold text-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao Produto
            </button>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && "Sair do Console"}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 px-8 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-6">
             <button 
               onClick={handleBackFromAdmin}
               className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all group"
             >
               <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
               <span className="text-xs font-bold">Voltar</span>
             </button>
             <div className="w-px h-6 bg-slate-200" />
             <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
               Admin do Product Constructor <ChevronRight className="w-4 h-4 text-slate-300" />
               <span className="text-slate-900 font-black uppercase tracking-widest text-[10px]">
                 {ADMIN_NAV.find(n => n.id === activeSection)?.label}
               </span>
             </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-100 shadow-inner">
               <div className="flex flex-col items-end">
                 <span className="text-[11px] font-black text-slate-900 leading-none">{profile?.display_name}</span>
                 <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black mt-1">
                   {adminCtx?.isOwner ? 'Owner' : 'Administrator'}
                 </span>
               </div>
               <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden bg-slate-200 shadow-sm">
                 {user?.photoURL && <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" />}
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-[0.03] pointer-events-none absolute inset-0" />
        
        <div className="flex-1 overflow-y-auto p-8 relative z-10">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeSection}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="max-w-7xl mx-auto w-full h-full"
             >
                {renderSection()}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
