import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: React.ReactNode;
  sectionName?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class ProductSectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ProductSectionErrorBoundary]", this.props.sectionName, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-white border border-rose-100 rounded-[2rem] p-8 shadow-sm">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>

            <h2 className="text-xl font-black text-slate-900">
              Erro ao carregar esta seção
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              A seção {this.props.sectionName || "selecionada"} encontrou um erro de runtime.
              O restante do produto continua disponível.
            </p>

            {this.state.error?.message && (
              <pre className="mt-4 p-4 bg-slate-950 text-slate-300 rounded-2xl text-xs overflow-auto max-h-64">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
