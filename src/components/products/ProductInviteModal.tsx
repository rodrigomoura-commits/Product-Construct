import React, { useState } from 'react';
import { X, Mail, Shield, Send, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Product, Profile, AdminCtx } from '../../types';
import { createProductInvite } from '../../lib/productInvites';
import toast from 'react-hot-toast';

interface Props {
  product: Product;
  user: any;
  adminCtx?: AdminCtx;
  profile?: Profile | null;
  onClose: () => void;
  onInviteSent?: () => void;
}

export default function ProductInviteModal({ product, user, adminCtx, onClose, onInviteSent }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'commenter' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ inviteId: string, token: string, inviteLink: string } | null>(null);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Email inválido');
      return;
    }

    setLoading(true);
    try {
      const result = await createProductInvite({
        product,
        email: email.toLowerCase().trim(),
        role,
        currentUser: user,
        adminCtx
      });
      setInviteResult(result);
      toast.success('Convite gerado com sucesso!');
      onInviteSent?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao enviar convite');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.inviteLink);
    toast.success('Link copiado!');
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-zinc-200">
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight">Convidar Pessoas</h3>
            <p className="text-zinc-500 text-xs font-medium italic">Use esta opção para pessoas que ainda não têm cadastro. Quando elas entrarem, o convite será convertido em colaboração.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-zinc-400 hover:text-zinc-900 transition-all border border-transparent hover:border-zinc-200 shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!inviteResult ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="email" 
                    placeholder="email@empresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Papel / Permissão</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'editor', label: 'Editor', desc: 'Pode editar conteúdo e artefatos.', icon: Shield },
                    { id: 'commenter', label: 'Comentador', desc: 'Pode ver e comentar sugestões.', icon: Mail },
                    { id: 'viewer', label: 'Visualizador', desc: 'Apenas leitura do produto.', icon: Shield },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id as any)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                        role === r.id ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-100 hover:border-zinc-300"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        role === r.id ? "bg-zinc-800 text-white" : "bg-zinc-50 text-zinc-400 group-hover:bg-zinc-100"
                      )}>
                        <r.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-xs font-black uppercase tracking-widest", role === r.id ? "text-white" : "text-zinc-900")}>{r.label}</p>
                        <p className={cn("text-[10px] font-medium leading-tight", role === r.id ? "text-zinc-400" : "text-zinc-500")}>{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleInvite}
                disabled={loading || !email.trim()}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-zinc-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Convite
              </button>
            </>
          ) : (
            <div className="text-center space-y-6">
               <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto border border-emerald-100 shadow-xl shadow-emerald-50">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
               </div>
               <div>
                 <h4 className="text-xl font-bold text-zinc-900 mb-2">Convite Criado!</h4>
                 <p className="text-zinc-500 text-sm font-medium max-w-xs mx-auto italic">
                   Como ainda não enviamos e-mails automáticos, copie o link abaixo e envie manualmente para o convidado.
                 </p>
               </div>
               
               <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between gap-4">
                  <span className="text-xs font-mono font-bold text-zinc-500 truncate text-left flex-1">
                    {inviteResult.inviteLink}
                  </span>
                  <button 
                    onClick={copyLink}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </button>
               </div>

               <button 
                  onClick={onClose}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl"
               >
                 Concluído
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
