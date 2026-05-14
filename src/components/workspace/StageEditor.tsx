import React, { useEffect, useState } from 'react';
import { Product, ProductStage, StageField, StageKey } from '../../types';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, setDoc, addDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../../lib/firebase';
import { 
  Info, Brain, Layout, Activity, Boxes, History, 
  HelpCircle, AlertTriangle, Sparkles, CheckCircle2, 
  Plus, Search, FileEdit, Trash2, Loader2, Save
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

const STAGE_CONFIG: Record<StageKey, { fields: { key: string, label: string, description: string }[] }> = {
  sense: {
    fields: [
      { key: 'target_client', label: 'Cliente observado', description: 'Quem é a pessoa que sofre com o problema?' },
      { key: 'hair_on_fire', label: 'Hair-on-fire problem', description: 'Qual é o problema real, urgente e crítico?' },
      { key: 'current_situation', label: 'Situação atual', description: 'Como o cliente resolve isso hoje? Qual o custo da inércia?' },
      { key: 'evidence_qual', label: 'Evidências (Synthesis Brief)', description: 'Padrões de dor, quotes e evidências qualitativas.' },
      { key: 'business_value', label: 'Valor para o Negócio', description: 'Por que resolver isso gera impacto estratégico?' },
    ]
  },
  shape: {
    fields: [
      { key: 'superpower', label: 'Hotmart Superpower', description: 'Por que nós somos os únicos que podem resolver isso?' },
      { key: 'pains_needs', label: 'Pains & Needs', description: 'Mapeamento detalhado das dores e necessidades.' },
      { key: 'rtbs', label: 'RTBs (Reasons to Believe)', description: 'Pilares que sustentam a promessa da solução.' },
      { key: 'competitive_taste', label: 'Diferencial de Taste', description: 'Onde nosso olhar humano supera a concorrência?' },
    ]
  },
  sketch: {
    fields: [
      { key: 'vignette', label: 'Vignette (Narrativa)', description: 'Situação -> Complicação -> Resolução -> Benefício.' },
      { key: 'craft_5d', label: '5 Dimensões de Craft', description: 'Visual, Animação, Voz, Tactilidade e Interatividade.' },
      { key: 'figma_prototype', label: 'Protótipo (Figma)', description: 'A materialização visual do conceito.' },
    ]
  },
  scope: {
    fields: [
      { key: 'mvp_scope', label: 'Escopo do MVP', description: 'O mínimo viável para entregar os RTBs.' },
      { key: 'gtm_strategy', label: 'Estratégia de GTM', description: 'Como vamos contar essa história para o mundo?' },
      { key: 'success_metrics', label: 'Métricas de Sucesso', description: 'Ballpark de ROI e impacto esperado.' },
    ]
  },
  ship: {
    fields: [
      { key: 'epic_jira', label: 'Epic (Pronto para Jira)', description: 'Contexto, escopo e critérios de aceite.' },
      { key: 'story_refining', label: 'Stories & Refinamento', description: 'Histórias detalhadas para a engenharia.' },
      { key: 'business_rules_alive', label: 'Regras de Negócio Vivas', description: 'Documentação da lógica de execução.' },
    ]
  },
  sense_plus: {
    fields: [
      { key: 'health_monitor', label: 'Saúde do Produto', description: 'Dashboard de métricas em tempo real.' },
      { key: 'learnings_log', label: 'Log de Aprendizados', description: 'O que descobrimos após o lançamento?' },
      { key: 'chapter_distillation', label: 'Destilação para Chapters', description: 'O que vira padrão para o resto da Hotmart?' },
    ]
  }
};

interface StageEditorProps {
  stage: ProductStage;
  product: Product;
}

export default function StageEditor({ stage, product }: StageEditorProps) {
  const [fields, setFields] = useState<StageField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    const path = `products/${product.id}/fields`;
    const q = query(collection(db, path), where('stage_key', '==', stage.stage_key), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setFields(snap.docs.map(d => ({ id: d.id, ...d.data() } as StageField)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsub;
  }, [stage.stage_key, product.id]);

  async function updateField(fieldKey: string, value: string) {
    setSavingField(fieldKey);
    const path = `products/${product.id}/fields`;
    try {
      const existing = fields.find(f => f.field_key === fieldKey);
      if (existing) {
        await updateDoc(doc(db, path, existing.id), {
          value,
          updated_at: serverTimestamp()
        });
      } else {
        const fieldConfig = STAGE_CONFIG[stage.stage_key].fields.find(f => f.key === fieldKey);
        await addDoc(collection(db, path), cleanFirestoreData({
          product_id: product.id,
          stage_id: stage.id,
          stage_key: stage.stage_key,
          field_key: fieldKey,
          label: fieldConfig?.label || fieldKey,
          value,
          classification: 'hypothesis',
          quality_status: 'draft',
          confidence: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    } finally {
      setSavingField(null);
    }
  }

  const config = STAGE_CONFIG[stage.stage_key];
  const missingFields = config.fields.filter(f => !fields.find(st => st.field_key === f.key));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{stage.name.split('.')[1].trim()}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Defina as hipóteses e fatos desta etapa</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maturidade calculada pela Tona</div>
          <div className="text-3xl font-black text-indigo-600">{stage.progress}%</div>
        </div>
      </header>

      {missingFields.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top duration-500">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
             <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest mb-1">Lacunas que a Tona encontrou</h4>
            <div className="flex flex-wrap gap-2">
               {missingFields.map(f => (
                 <span key={f.key} className="px-3 py-1 bg-white/50 border border-amber-200 rounded-full text-[10px] font-bold text-amber-700">
                   {f.label}
                 </span>
               ))}
            </div>
            <p className="mt-3 text-xs text-amber-600 font-medium">Fale com a Tona para preencher esses pontos e amadurecer a etapa.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {config.fields.map((field) => {
          const storedField = fields.find(f => f.field_key === field.key);
          const isSaving = savingField === field.key;
          
          return (
            <div key={field.key} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                    <FileEdit className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 tracking-tight leading-none mb-1">{field.label}</h3>
                    <p className="text-xs font-medium text-slate-400">{field.description}</p>
                  </div>
                </div>
                {storedField && (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      storedField.quality_status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {storedField.quality_status === 'approved' ? 'Validado' : 'Draft'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <textarea
                  defaultValue={storedField?.value || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (storedField?.value || '')) {
                      updateField(field.key, e.target.value);
                    }
                  }}
                  placeholder={`Descreva aqui...`}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-200 transition-all min-h-[100px] resize-none"
                />
                {isSaving && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm animate-in fade-in zoom-in">
                    <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Salvando</span>
                  </div>
                )}
                 {!isSaving && storedField && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Salvo</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-10 flex items-center justify-center">
        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-red-600">Limpar esta etapa</span>
        </button>
      </div>
    </div>
  );
}
