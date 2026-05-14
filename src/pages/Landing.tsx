import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Boxes, LayoutDashboard, Brain, Shield, Bot, History, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function Landing() {
  const { user, signIn, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/products" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
            <Boxes className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Product Constructor</span>
        </div>
        <button 
          onClick={signIn}
          className="bg-slate-900 text-white px-5 py-2 rounded-full font-medium text-sm hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
        >
          Entrar com Google
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-24 flex flex-col items-center text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6 }}
           className="mb-8 p-1 px-3 bg-indigo-50 rounded-full border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"
        >
          <Sparkles className="w-3 h-3 text-indigo-500" />
          IA Generativa + Framework de Produto
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-6xl md:text-7xl font-black text-slate-900 tracking-tight mb-8 leading-[1.05]"
        >
          Do problema ao <br/>aprendizado, com IA.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-slate-500 max-w-2xl mb-12 leading-relaxed"
        >
          Product Constructor é a plataforma definitiva para arquitetura de produtos. 
          Construa hipóteses, valide propostas, planeje MVPs e gere artefatos reais 
          com agentes de IA especializados.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 mb-24"
        >
          <button 
            onClick={signIn}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            Começar Gratuitamente
          </button>
          <button className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            Ver Demonstração
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {[
            { icon: LayoutDashboard, title: "Workspace de Produto", desc: "Ambiente dedicado para cada projeto com jornada guiada." },
            { icon: Brain, title: "Mindflow", desc: "A IA aprende sobre o seu produto e ajuda a manter a consistência através de memórias evolutivas." },
            { icon: Bot, title: "Agentes Especialistas", desc: "Diferentes personas de IA para cada etapa da jornada." },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white border border-slate-200 rounded-3xl text-left hover:border-indigo-400 transition-all group shadow-sm"
            >
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Boxes className="text-indigo-600 w-5 h-5" />
            <span className="font-bold text-slate-900">Product Constructor</span>
          </div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider italic">© 2024 Product Constructor. Built with Antigravity.</p>
        </div>
      </footer>
    </div>
  );
}
