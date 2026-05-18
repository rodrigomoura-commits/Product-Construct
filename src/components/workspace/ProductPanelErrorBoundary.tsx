import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  panelName: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ProductPanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[Panel Error: ${this.props.panelName}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[400px] items-center justify-center p-8 text-center shrink-0">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
             <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-sm font-black text-slate-900 mb-2">Erro na {this.props.panelName}</h3>
          <p className="text-[11px] text-slate-500 italic mb-6 leading-relaxed">
             Não conseguimos carregar este painel no momento. O restante do produto continua disponível para uso.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
          >
             <RefreshCcw className="w-3 h-3" />
             Recarregar Tona
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
