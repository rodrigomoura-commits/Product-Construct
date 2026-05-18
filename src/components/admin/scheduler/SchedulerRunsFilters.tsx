export function SchedulerRunsFilters({
  filters = {},
  setFilters,
  jobs = []
}: any) {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  return (
    <div className="mb-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto]">
        <input
          value={filters.search || ""}
          onChange={(e) => setFilters((prev: any) => ({ ...prev, search: e.target.value }))}
          placeholder="Buscar por job, erro ou log..."
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-300"
        />

        <select
          value={filters.jobId || "all"}
          onChange={(e) => setFilters((prev: any) => ({ ...prev, jobId: e.target.value }))}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-widest outline-none"
        >
          <option value="all">Todos os jobs</option>
          {safeJobs.map((job: any) => (
            <option key={job.id} value={job.id}>
              {job.name || job.id}
            </option>
          ))}
        </select>

        <select
          value={filters.status || "all"}
          onChange={(e) => setFilters((prev: any) => ({ ...prev, status: e.target.value }))}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-widest outline-none"
        >
          <option value="all">Todos os status</option>
          <option value="running">Rodando</option>
          <option value="success">Sucesso</option>
          <option value="partial">Parcial</option>
          <option value="error">Erro</option>
          <option value="cancelled">Cancelado</option>
        </select>

        <select
          value={filters.period || "24h"}
          onChange={(e) => setFilters((prev: any) => ({ ...prev, period: e.target.value }))}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-widest outline-none"
        >
          <option value="1h">Última 1h</option>
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="all">Tudo</option>
        </select>

        <button
          type="button"
          onClick={() =>
            setFilters({
              status: "all",
              jobId: "all",
              onlyErrors: false,
              period: "24h",
              search: ""
            })
          }
          className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
        >
          Limpar
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
        <input
          type="checkbox"
          checked={!!filters.onlyErrors}
          onChange={(e) => setFilters((prev: any) => ({ ...prev, onlyErrors: e.target.checked }))}
        />
        Mostrar apenas execuções com erro
      </label>
    </div>
  );
}
