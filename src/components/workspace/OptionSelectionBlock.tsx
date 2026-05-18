import React from 'react';
import { cn } from '../../lib/utils';

interface Option {
  id: string;
  letter: string;
  label: string;
  title?: string;
  short_label: string;
  description: string;
  value: string;
}

interface Props {
  options: Option[];
  onSelect: (option: Option) => void;
  allowsFreeText?: boolean;
  onOther?: () => void;
}

export const OptionSelectionBlock: React.FC<Props> = ({ options, onSelect, allowsFreeText, onOther }) => {
  return (
    <div className="mt-4 space-y-3">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all space-y-1"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-indigo-600">{option.letter}</span>
            <span className="text-sm font-black text-slate-800 tracking-tight">{option.label}</span>
          </div>
          <p className="text-xs text-slate-500 font-medium pl-9 leading-relaxed">{option.description}</p>
        </button>
      ))}
      {allowsFreeText && (
        <button
          onClick={onOther}
          className="w-full text-center p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black text-slate-600 uppercase tracking-widest transition-all"
        >
          Outro caminho
        </button>
      )}
    </div>
  );
};
