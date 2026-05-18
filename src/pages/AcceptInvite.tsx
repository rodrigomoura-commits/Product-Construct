import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { findInviteByToken, acceptProductInvite } from '../lib/productInvites';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AcceptInvite() {
  const { token } = useParams();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvite();
    }
  }, [token]);

  async function loadInvite() {
    setLoading(true);
    try {
      const data = await findInviteByToken(token!);
      if (!data) {
        setError("Convite não encontrado ou já utilizado.");
      } else if (data.status !== 'pending') {
        setError("Este convite já foi aceito ou revogado.");
      } else if (data.expires_at.toDate() < new Date()) {
        setError("Este convite expirou.");
      } else {
        setInvite(data);
      }
    } catch (e: any) {
      setError("Erro ao carregar convite.");
    } finally {
      setLoading(false);
    }
  }

  const handleAccept = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para aceitar o convite.");
      return;
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      setError(`Este convite foi enviado para ${invite.email}, mas você está logado como ${user.email}.`);
      return;
    }

    setProcessing(true);
    try {
      const productId = await acceptProductInvite({ token: token!, currentUser: user });
      toast.success("Convite aceito com sucesso!");
      navigate(`/products/${productId}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao aceitar convite.");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Validando convite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-rose-100">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Ops! Algo deu errado</h2>
        <p className="text-slate-500 max-w-md italic mb-8">{error}</p>
        <button 
          onClick={() => navigate('/products')}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
        >
          Ir para Meus Produtos
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-md p-10 border border-slate-100 shadow-2xl shadow-slate-200 text-center space-y-8">
        <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto border border-indigo-100 shadow-xl shadow-indigo-50">
          <CheckCircle2 className="w-12 h-12 text-indigo-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 leading-tight">Você foi convidado!</h1>
          <p className="text-slate-500 font-medium italic">
            Para colaborar no produto <span className="text-slate-900 font-black not-italic">"{invite.product_name}"</span> como <span className="text-indigo-600 font-black not-italic uppercase tracking-widest text-xs">{invite.role}</span>.
          </p>
        </div>

        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-left space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <ArrowRight className="w-4 h-4 text-slate-400" />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Enviado por</p>
               <p className="text-sm font-black text-slate-900 truncate">{invite.invited_by_name}</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <ArrowRight className="w-4 h-4 text-slate-400" />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destinatário</p>
               <p className="text-sm font-black text-slate-900 truncate">{invite.email}</p>
             </div>
          </div>
        </div>

        <div className="pt-4">
          {!user ? (
            <button 
              onClick={signIn}
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95"
            >
              Fazer Login para Aceitar
            </button>
          ) : (
            <button 
              onClick={handleAccept}
              disabled={processing}
              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Aceitar Convite e Entrar
            </button>
          )}
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          AI-POWERED PRODUCT INTELLIGENCE
        </p>
      </div>
    </div>
  );
}
