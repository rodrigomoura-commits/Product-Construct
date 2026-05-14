import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../lib/firebase';
import { Layout, Database, Shield, Globe, HardDrive } from 'lucide-react';

export default function FirebaseDebug() {
  const { user, adminCtx, quotaExceeded } = useAuth();

  if (!adminCtx?.isAdmin) {
    return (
      <div className="p-20 text-center">
        <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Apenas administradores podem visualizar esta página.</p>
      </div>
    );
  }

  const config = {
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    appId: firebaseConfig.appId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Firebase Audit</h1>
            <p className="text-slate-500 text-sm font-medium italic">Monitorando infraestrutura e cotas em tempo real</p>
          </div>
        </div>

        {quotaExceeded && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-4 animate-pulse">
            <div className="w-4 h-4 bg-red-500 rounded-full" />
            <p className="text-red-700 font-bold text-sm">LIMITE DE COTA (QUOTA) ATINGIDO NO FIRESTORE</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-slate-400" />
              <h2 className="font-bold text-slate-700">Identificadores</h2>
            </div>
            <dl className="space-y-4">
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Project ID</dt>
                <dd className="bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600 border border-slate-100 truncate">{config.projectId}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Database ID</dt>
                <dd className="bg-indigo-50 p-2 rounded-lg font-mono text-xs text-indigo-600 border border-indigo-100 truncate">{config.databaseId || '(default)'}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">App ID</dt>
                <dd className="bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600 border border-slate-100 truncate">{config.appId}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="w-5 h-5 text-slate-400" />
              <h2 className="font-bold text-slate-700">Recursos</h2>
            </div>
            <dl className="space-y-4">
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Auth Domain</dt>
                <dd className="bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600 border border-slate-100 truncate">{config.authDomain}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Storage Bucket</dt>
                <dd className="bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600 border border-slate-100 truncate">{config.storageBucket}</dd>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Status de Conexão</span>
                  <span className="bg-emerald-500 w-2 h-2 rounded-full animate-ping" />
                </div>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 bg-slate-900 p-8 rounded-[2rem] text-white overflow-hidden relative shadow-2xl shadow-indigo-200">
           <div className="relative z-10">
              <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                <Layout className="w-5 h-5 text-indigo-400" />
                Dicas de Otimização
              </h3>
              <ul className="space-y-3 text-sm text-slate-300 font-medium">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-[10px] mt-0.5 font-bold">1</span>
                  <span>Use <strong>limit(20)</strong> em todas as listagens administrativas.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-[10px] mt-0.5 font-bold">2</span>
                  <span>Evite <strong>onSnapshot</strong> em coleções com centenas de documentos. Preferira leituras sob demanda.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-[10px] mt-0.5 font-bold">3</span>
                  <span>Verifique se o banco de dados tem índices compostos para evitar scans lineares caros.</span>
                </li>
              </ul>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -mr-20 -mt-20" />
        </div>
      </div>
    </div>
  );
}
