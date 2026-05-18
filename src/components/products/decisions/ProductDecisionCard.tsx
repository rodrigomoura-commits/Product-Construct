import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Eye, 
  RefreshCw, 
  User,
  History
} from 'lucide-react';
import { ProductDecision, Product } from '../../../types';
import { formatDate, cn } from '../../../lib/utils';

interface Props {
  decision: ProductDecision;
  product: Product;
  onEdit?: () => void;
  onDiscuss?: () => void;
  onSupersede?: () => void;
  onArchive?: () => void;
  onViewDetails?: () => void;
}

export default function ProductDecisionCard({ 
  decision, 
  onEdit, 
  onDiscuss, 
  onSupersede, 
  onArchive,
  onViewDetails 
}: Props) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'draft': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'superseded': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'archived': return 'bg-rose-50 text-rose-500 border-rose-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getDirectionColor = (dir: string) => {
    switch (dir) {
      case 'chosen': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'deferred': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getTypeName = (type: string) => {
    const types: Record<string, string> = {
      product: 'Produto',
      business: 'Negócio',
      technology: 'Tecnologia',
      experience: 'Experiência',
      mvp_scope: 'Escopo / MVP',
      gtm: 'GTM',
      data: 'Dados',
      ai: 'IA',
      integration: 'Integração',
      architecture: 'Arquitetura',
      process: 'Processo',
      other: 'Outro'
    };
    return types[type] || type;
  };

  const getStageName = (key: string) => {
    const stages: Record<string, string> = {
      sense: 'Entender',
      shape: 'Definir',
      sketch: 'Visualizar',
      scope: 'Planejar',
      ship: 'Entregar',
      sense_plus: 'Acompanhar'
    };
    return stages[key] || key;
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm hover:shadow-xl hover:shadow-slate-100/50 hover:border-indigo-200 transition-all group flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">
            {getTypeName(decision.decision_type)}
          </span>
          <span className={cn(
            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
            getStatusColor(decision.status)
          )}>
            {decision.status === 'active' ? 'Ativa' : decision.status}
          </span>
          {decision.stage_key && (
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">
              {getStageName(decision.stage_key)}
            </span>
          )}
        </div>
        <div className={cn(
          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm",
          getDirectionColor(decision.direction)
        )}>
          {decision.direction === 'chosen' ? 'Escolhida' : decision.direction}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors mb-4">
        {decision.title}
      </h3>

      {/* Decision Statement */}
      <div className="bg-slate-50 rounded-2xl p-5 mb-4 border border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Decisão:</p>
        <p className="text-sm font-bold text-slate-700 leading-relaxed line-clamp-3">
          {decision.decision_statement}
        </p>
      </div>

      {/* Rationale */}
      <div className="mb-6 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Por que:</p>
        <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-3 italic">
          "{decision.rationale}"
        </p>
      </div>

      {/* Impact Areas */}
      {decision.impact_areas && decision.impact_areas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {decision.impact_areas.map(area => (
            <span key={area} className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-slate-100">
              {area}
            </span>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
              <User className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[100px]">
                {decision.decided_by_name?.split(' ')[0] || 'Autor'}
              </p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                {formatDate(decision.created_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
            onClick={onViewDetails}
            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            title="Ver Detalhes"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={onDiscuss}
            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            title="Discutir com a Tona"
          >
            <MessageSquare className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={onEdit}
            className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
            title="Editar"
          >
            <Edit3 className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={onSupersede}
            className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
            title="Substituir Decisão"
          >
            <History className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
