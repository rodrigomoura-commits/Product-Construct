import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BehavioralTracker } from './components/mindflow/BehavioralTracker';
import { Loader2 } from 'lucide-react';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductWorkspace = lazy(() => import('./pages/ProductWorkspace'));
const AdminConsole = lazy(() => import('./pages/AdminConsole'));
const FirebaseDebug = lazy(() => import('./pages/FirebaseDebug'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const InviteAccept = lazy(() => import('./pages/InviteAccept'));
const AcceptUserInvite = lazy(() => import('./pages/AcceptUserInvite'));

const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, adminCtx, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-white rounded-lg shadow-sm" />
          </div>
        </div>
        <p className="mt-4 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Iniciando Tona</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/" />;
  
  if (adminOnly && !adminCtx?.isAdmin) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-red-100">
          <Loader2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase">Acesso Restrito</h1>
        <p className="text-slate-500 mb-8 max-w-sm font-medium italic">Você não tem permissões administrativas para acessar o TonaCore.</p>
        <button 
          onClick={() => window.location.href = '/products'} 
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          Voltar para Workspace
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

import { Toaster } from 'react-hot-toast';
import { RefreshCw, AlertTriangle } from 'lucide-react';

function QuotaBanner() {
  const { quotaExceeded } = useAuth();
  
  if (!quotaExceeded) return null;
  
  return (
    <div className="bg-red-600 text-white px-4 py-2 text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 animate-pulse sticky top-0 z-[100]">
      <AlertTriangle className="w-4 h-4" />
      Capacidade gratuita do banco de dados atingida (Quota). Dados podem estar incompletos.
      <button onClick={() => window.location.reload()} className="bg-white text-red-600 px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 hover:bg-slate-100 transition-colors">
        <RefreshCw className="w-3 h-3" /> Recarregar
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QuotaBanner />
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#fff',
          color: '#1e293b',
          fontSize: '12px',
          fontWeight: 'bold',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
        }
      }} />
      <BrowserRouter>
        <BehavioralTracker />
        <Suspense fallback={
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Tona está organizando o raciocínio</p>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/products" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/products/:productId" element={
              <ProtectedRoute>
                <ProductWorkspace />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <AdminConsole />
              </ProtectedRoute>
            } />
            <Route path="/admin/debug" element={
              <ProtectedRoute adminOnly>
                <FirebaseDebug />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <UserSettings />
              </ProtectedRoute>
            } />
            <Route path="/invite/:token" element={<AcceptUserInvite />} />
            <Route path="/invites/user/:token" element={<AcceptUserInvite />} />
            <Route path="/invites/product/:token" element={<AcceptInvite />} />
            {/* Rotas legadas de Memória */}
            <Route path="/admin/memory" element={<Navigate to="/admin?section=mindflow" replace />} />
            <Route path="/admin/memoria" element={<Navigate to="/admin?section=mindflow" replace />} />
            <Route path="/admin/generative-memory" element={<Navigate to="/admin?section=mindflow" replace />} />
            <Route path="/admin/mindflow-memory" element={<Navigate to="/admin?section=mindflow" replace />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
