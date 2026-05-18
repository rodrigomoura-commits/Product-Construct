import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MessageSquare, Bot, User, Clock, Filter } from 'lucide-react';
import { ConversationMessage } from '../../lib/conversationHistory';
import { cn } from '../../lib/utils';

const JOURNEY_STAGES = [
  { key: 'sense', label: '1. Entender o Problema' },
  { key: 'shape', label: '2. Definir a Proposta' },
  { key: 'sketch', label: '3. Visualizar a Solução' },
  { key: 'scope', label: '4. Planejar o MVP' },
  { key: 'ship', label: '5. Preparar a Entrega' },
  { key: 'sense_plus', label: '6. Acompanhar e Aprender' },
];

interface Props {
  productId: string;
}

export default function HistoryPanel({ productId }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('all');

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const q = query(
          collection(db, `products/${productId}/conversation_messages`),
          orderBy('created_at', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ConversationMessage));
        setMessages(msgs);
      } catch (e) {
        console.error("Error loading history:", e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [productId]);

  const filteredMessages = messages.filter(m => filterStage === 'all' || m.stage_key === filterStage);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Timeline do Produto</h2>
          <p className="text-xs font-medium text-slate-500">Histórico completo de interações, decisões e contexto.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="text-xs font-bold bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas as etapas</option>
              {JOURNEY_STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <MessageSquare className="w-8 h-8 mb-4 opacity-50" />
            <p className="text-sm font-bold">Nenhum evento registrado.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {filteredMessages.map((msg, idx) => (
              <div key={msg.id || idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                    msg.role === 'assistant' 
                      ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
                      : "bg-slate-100 border-slate-200 text-slate-600"
                  )}>
                    {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  {idx < filteredMessages.length - 1 && (
                    <div className="w-px h-full bg-slate-200 my-2" />
                  )}
                </div>
                
                <div className="flex-1 pb-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                          {msg.role === 'assistant' ? 'Tona' : msg.user_email || 'Você'}
                        </span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-indigo-500">
                          {msg.stage_key}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-bold">
                          {msg.created_at?.toDate ? msg.created_at.toDate().toLocaleString() : 'Agora'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="prose prose-sm prose-slate max-w-none text-[13px] leading-relaxed">
                      {msg.content}
                    </div>

                    {msg.role === 'assistant' && msg.question_strategy?.options?.length > 0 && (
                      <div className="mt-4 flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Opções oferecidas:</span>
                        <div className="flex flex-wrap gap-2">
                          {msg.question_strategy.options.map((opt: any, i: number) => (
                            <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600">
                              {opt.letter ? `${opt.letter}. ` : ''}{opt.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
