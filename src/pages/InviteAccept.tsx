import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { acceptProductInvite } from '../lib/productInvites';
import { Boxes, Loader2, CheckCircle2, AlertCircle, Sparkles, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const { user, profile, signIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && token && !success && !error) {
      handleAccept();
    } else if (!user) {
      setLoading(false);
    }
  }, [user, token]);

  async function handleAccept() {
    if (!token || !user) return;
    setLoading(true);
    try {
      const pId = await acceptProductInvite({ token, currentUser: user });
      setProductId(pId);
      setSuccess(true);
      toast.success('Convite aceito com sucesso!');
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate(`/products/${pId}`);
      }, 3000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Erro ao aceitar convite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-zinc-200">
        
        {/* Header Art */}
        <div className="h-48 bg-zinc-900 flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,#4f46e5_0%,transparent_50%)]" />
              <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_70%,#4f46e5_0%,transparent_50%)]" />
           </div>
           <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl relative z-10">
              <Boxes className="w-12 h-12 text-zinc-900" />
           </div>
        </div>

        <div className="p-10 space-y-8 text-center">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Convite de Colaboração</h1>
            <p className="text-zinc-500 font-medium italic leading-relaxed">
              Você foi convidado para construir o futuro de um produto incrível.
            </p>
          </div>

          {!user ? (
            <div className="space-y-6">
               <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl text-sm font-medium text-zinc-600 italic">
                  Para aceitar o convite e acessar o workspace, você precisa estar autenticado na plataforma.
               </div>
               <button 
                onClick={signIn}
                className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
               >
                 <LogIn className="w-5 h-5" />
                 Entrar com Google
               </button>
            </div>
          ) : loading ? (
            <div className="py-12 space-y-4">
               <Loader2 className="w-12 h-12 text-zinc-900 animate-spin mx-auto" />
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Validando convite...</p>
            </div>
          ) : success ? (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
               <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto border border-emerald-100 shadow-xl shadow-emerald-50">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-zinc-900 mb-2">Tudo Pronto!</h2>
                  <p className="text-zinc-500 text-sm font-medium leading-relaxed italic">
                    Você agora é um colaborador oficial. Redirecionando para o workspace...
                  </p>
               </div>
               <button 
                onClick={() => navigate(`/products/${productId}`)}
                className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl"
               >
                 Acessar Agora <Sparkles className="w-5 h-5" />
               </button>
            </div>
          ) : error ? (
            <div className="space-y-8">
               <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-100">
                  <AlertCircle className="w-10 h-10 text-rose-500" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-zinc-900 mb-2">Oops! Algo deu errado</h2>
                  <p className="text-rose-500 text-sm font-bold bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    {error}
                  </p>
               </div>
               <button 
                onClick={() => navigate('/')}
                className="w-full py-5 bg-zinc-100 text-zinc-600 rounded-[2rem] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-sm"
               >
                 Voltar para Início
               </button>
            </div>
          ) : null}
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100 text-center">
           <p className="text-[10px] font-black uppercase text-zinc-300 tracking-[0.2em]">Product Constructor • Tona Engine 2.0</p>
        </div>
      </div>
    </div>
  );
}
