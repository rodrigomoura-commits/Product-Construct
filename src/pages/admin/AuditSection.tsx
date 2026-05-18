import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Download,
  FileText,
  RefreshCw,
  Search,
  Shield,
  User,
  X
} from "lucide-react";
import { AuditLog, watchAuditLogs } from "../../lib/auditLogs";
import {
  getAuditCategoryLabel,
  getAuditSeverityLabel,
  getAuditTypeLabel
} from "../../lib/auditLogLabels";
import { formatAuditDate, formatRelativeDate } from "../../lib/dateUtils";

function getSeverityClass(severity?: string) {
  if (severity === "critical") {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }

  if (severity === "warning") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-100";
}

function getCategoryClass(category?: string) {
  const map: Record<string, string> = {
    user_management: "bg-violet-50 text-violet-700 border-violet-100",
    access: "bg-rose-50 text-rose-700 border-rose-100",
    product: "bg-blue-50 text-blue-700 border-blue-100",
    decision: "bg-indigo-50 text-indigo-700 border-indigo-100",
    document: "bg-cyan-50 text-cyan-700 border-cyan-100",
    mindflow: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100",
    integration: "bg-orange-50 text-orange-700 border-orange-100",
    llm: "bg-purple-50 text-purple-700 border-purple-100",
    security: "bg-red-50 text-red-700 border-red-100",
    system: "bg-slate-100 text-slate-600 border-slate-200"
  };

  return map[category || "system"] || map.system;
}

function normalizeText(value: any) {
  return String(value || "").toLowerCase().trim();
}

export default function AuditSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = watchAuditLogs({
      maxResults: 200,
      onData: (items) => {
        setLogs(items);
        setLoading(false);
      },
      onError: (err) => {
        setError(err.message || "Não foi possível carregar os logs.");
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const filteredLogs = useMemo(() => {
    const text = normalizeText(search);

    return logs.filter((log) => {
      const matchesSearch =
        !text ||
        normalizeText(log.summary).includes(text) ||
        normalizeText(log.actor_email).includes(text) ||
        normalizeText(log.target_email).includes(text) ||
        normalizeText(log.product_name).includes(text) ||
        normalizeText(log.type).includes(text);

      const matchesCategory =
        categoryFilter === "all" || (log.category || "system") === categoryFilter;

      const matchesSeverity =
        severityFilter === "all" || (log.severity || "info") === severityFilter;

      const matchesType =
        typeFilter === "all" || log.type === typeFilter;

      return matchesSearch && matchesCategory && matchesSeverity && matchesType;
    });
  }, [logs, search, categoryFilter, severityFilter, typeFilter]);

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.type).filter(Boolean))).sort();
  }, [logs]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      critical: logs.filter((log) => log.severity === "critical").length,
      warning: logs.filter((log) => log.severity === "warning").length,
      users: logs.filter((log) => log.category === "user_management").length
    };
  }, [logs]);

  function exportCsv() {
    const header = [
      "created_at",
      "type",
      "category",
      "severity",
      "actor_email",
      "target_email",
      "product_name",
      "summary"
    ];

    const rows = filteredLogs.map((log) => [
      formatAuditDate(log.created_at),
      log.type || "",
      log.category || "",
      log.severity || "",
      log.actor_email || "",
      log.target_email || "",
      log.product_name || "",
      log.summary || ""
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-violet-500">
            Administração
          </p>

          <h1 className="text-4xl font-black tracking-tight text-slate-950">
            Auditoria
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold italic text-slate-500">
            Histórico completo de ações administrativas e mudanças críticas de estado.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={filteredLogs.length === 0}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg transition-all hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Total
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950">
                {stats.total}
              </p>
            </div>
            <Activity className="h-5 w-5 text-violet-500" />
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Eventos registrados
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Críticos
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950">
                {stats.critical}
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-rose-500" />
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Exigem atenção
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Alertas
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950">
                {stats.warning}
              </p>
            </div>
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Mudanças sensíveis
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Usuários
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950">
                {stats.users}
              </p>
            </div>
            <User className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Ações de acesso
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por ação, usuário, produto ou resumo..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="all">Todas as categorias</option>
            <option value="user_management">Usuários</option>
            <option value="access">Acesso</option>
            <option value="product">Produto</option>
            <option value="decision">Decisão</option>
            <option value="document">Documento</option>
            <option value="mindflow">Mindflow</option>
            <option value="integration">Integrações</option>
            <option value="llm">LLM</option>
            <option value="security">Segurança</option>
            <option value="system">Sistema</option>
          </select>

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="all">Todas as severidades</option>
            <option value="info">Informativo</option>
            <option value="warning">Atenção</option>
            <option value="critical">Crítico</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="all">Todos os tipos</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {getAuditTypeLabel(type)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
              setSeverityFilter("all");
              setTypeFilter("all");
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-500 transition-all hover:border-violet-200 hover:text-violet-600"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-50 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black text-slate-950">
              Não consegui carregar os logs
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {error}
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
              <Clock className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-slate-950">
              Nenhum log encontrado
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">
              Quando ações administrativas forem executadas, elas aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedLog(log)}
                className="flex w-full items-start gap-4 p-5 text-left transition-all hover:bg-slate-50"
              >
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-violet-500">
                  <FileText className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getCategoryClass(log.category)}`}>
                      {getAuditCategoryLabel(log.category)}
                    </span>

                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getSeverityClass(log.severity)}`}>
                      {getAuditSeverityLabel(log.severity)}
                    </span>

                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {getAuditTypeLabel(log.type)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-black text-slate-950">
                    {log.summary || getAuditTypeLabel(log.type)}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                    <span>
                      Ator: {log.actor_email || "Sistema"}
                    </span>

                    {log.target_email && (
                      <span>
                        Alvo: {log.target_email}
                      </span>
                    )}

                    {log.product_name && (
                      <span>
                        Produto: {log.product_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-black text-slate-700">
                    {formatRelativeDate(log.created_at)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    {formatAuditDate(log.created_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-500">
                  Detalhes do log
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {getAuditTypeLabel(selectedLog.type)}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {formatAuditDate(selectedLog.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-2xl bg-slate-50 p-3 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Categoria
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {getAuditCategoryLabel(selectedLog.category)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Severidade
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {getAuditSeverityLabel(selectedLog.severity)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Ator
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {selectedLog.actor_email || "Sistema"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Alvo
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {selectedLog.target_email || selectedLog.product_name || "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Resumo
                </p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
                  {selectedLog.summary}
                </p>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-950 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Metadata
                </p>
                <pre className="overflow-auto text-xs font-bold leading-relaxed text-white">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
