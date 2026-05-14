import React, { useState } from 'react';
import { Upload, FileUp, DatabaseZap, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AdminCtx } from '../../../types';
import ImportLearningsModal from './ImportLearningsModal';

interface ImportLearningsButtonProps {
  ctx: AdminCtx;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
}

export default function ImportLearningsButton({ ctx, className, variant = 'primary' }: ImportLearningsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasPermission = ctx.isAdmin;

  const handleClick = (e: React.MouseEvent) => {
    if (!hasPermission) {
      e.preventDefault();
      return;
    }
    setIsOpen(true);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return "bg-zinc-100 text-zinc-600 hover:bg-zinc-200";
      case 'ghost':
        return "bg-transparent text-zinc-500 hover:bg-zinc-50";
      case 'icon':
        return "w-11 h-11 p-0 flex items-center justify-center bg-zinc-50 text-zinc-400 hover:bg-zinc-900 hover:text-white border border-zinc-100";
      default:
        return "bg-zinc-900 text-white shadow-xl hover:bg-zinc-800";
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={!hasPermission}
        title={!hasPermission ? "Você não tem permissão para importar Aprendizagens." : "Importe Aprendizagens Base ou Adquiridas a partir de um CSV."}
        className={cn(
          "px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
          getVariantStyles(),
          className
        )}
      >
        <Upload className={cn("w-4 h-4", variant === 'icon' && "w-5 h-5")} />
        {variant !== 'icon' && <span>Importar Aprendizagens</span>}
      </button>

      {isOpen && (
        <ImportLearningsModal 
          isOpen={isOpen} 
          onClose={() => setIsOpen(false)} 
          ctx={ctx} 
        />
      )}
    </>
  );
}
