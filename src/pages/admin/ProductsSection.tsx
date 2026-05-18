import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Boxes,
  Crown,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadAdminProducts } from "../../lib/adminProducts";
import { formatSafeDate, formatShortDate } from "../../lib/dateUtils";
import { calculateAndSyncProductProgress } from "../../lib/productProgressSync";
import { getDisplayProgress } from "../../lib/progressUtils";

function getHealthBadge(product: any) {
  if (product.access_health === "critical") {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }

  if (product.access_health === "warning") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-100";
}

function getHealthLabel(product: any) {
  if (product.access_health === "critical") return "Crítico";
  if (product.access_health === "warning") return "Atenção";
  return "OK";
}

export default function ProductsAdminSection() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [normalizationFilter, setNormalizationFilter] = useState("all");

  const [openMenuProductId, setOpenMenuProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const result = await loadAdminProducts();
      
      const enrichedProducts = await Promise.all(
        result.products.map(async (p: any) => {
          try {
            const calculatedProgress = await calculateAndSyncProductProgress(p.id);
            return {
              ...p,
              progress: calculatedProgress,
              overall_progress: calculatedProgress,
              evolution_score: calculatedProgress,
              calculatedProgress
            };
          } catch (e) {
            return p;
          }
        })
      );

      setProducts(enrichedProducts);
      setUsers(result.users);
    } catch (err: any) {
      console.error("[AdminProductsSection] Error loading products:", err);
      setError(err?.message || "Não foi possível carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((p) => (p.status || "active") === "active").length,
      critical: products.filter((p) => p.access_health === "critical").length,
      needsNormalization: products.filter((p) => p.needs_normalization).length,
      pendingInvites: products.reduce((sum, p) => sum + (p.pending_invites_count || 0), 0)
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !text ||
        String(product.name || "").toLowerCase().includes(text) ||
        String(product.id || "").toLowerCase().includes(text) ||
        String(product.created_by_email || "").toLowerCase().includes(text) ||
        product.owners?.some((owner: any) =>
          String(owner.email || "").toLowerCase().includes(text) ||
          String(owner.display_name || "").toLowerCase().includes(text)
        );

      const matchesStatus =
        statusFilter === "all" || (product.status || "active") === statusFilter;

      const matchesHealth =
        healthFilter === "all" || product.access_health === healthFilter;

      const matchesNormalization =
        normalizationFilter === "all" ||
        (normalizationFilter === "needs" && product.needs_normalization) ||
        (normalizationFilter === "ok" && !product.needs_normalization);

      return matchesSearch && matchesStatus && matchesHealth && matchesNormalization;
    });
  }, [products, search, statusFilter, healthFilter, normalizationFilter]);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-violet-500">
            Administração
          </p>

          <h1 className="text-4xl font-black tracking-tight text-slate-950">
            Produtos
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold italic text-slate-500">
            Gerencie produtos, proprietários, colaboradores, convites e saúde de acesso.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm hover:border-violet-200 hover:text-violet-600"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Boxes className="h-5 w-5 text-violet-500" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total</p>
          <p className="mt-2 text-4xl font-black text-slate-950">{stats.total}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Produtos cadastrados</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Ativos</p>
          <p className="mt-2 text-4xl font-black text-slate-950">{stats.active}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Em uso</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Críticos</p>
          <p className="mt-2 text-4xl font-black text-slate-950">{stats.critical}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Sem owner ou acesso quebrado</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Crown className="h-5 w-5 text-amber-500" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Normalização</p>
          <p className="mt-2 text-4xl font-black text-slate-950">{stats.needsNormalization}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Precisam revisão</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Users className="h-5 w-5 text-blue-500" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Convites</p>
          <p className="mt-2 text-4xl font-black text-slate-950">{stats.pendingInvites}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Pendentes</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por produto, owner, e-mail ou ID..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="draft">Rascunhos</option>
            <option value="archived">Arquivados</option>
          </select>

          <select
            value={healthFilter}
            onChange={(event) => setHealthFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="all">Toda saúde</option>
            <option value="ok">OK</option>
            <option value="warning">Atenção</option>
            <option value="critical">Crítico</option>
          </select>

          <select
            value={normalizationFilter}
            onChange={(event) => setNormalizationFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="all">Normalização</option>
            <option value="needs">Precisa normalizar</option>
            <option value="ok">Normalizado</option>
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h3 className="mt-4 text-xl font-black text-slate-950">Erro ao carregar produtos</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center">
            <Boxes className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-xl font-black text-slate-950">Nenhum produto encontrado</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">Ajuste os filtros ou crie um novo produto.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <div key={product.id} className="relative flex items-center gap-5 p-5 hover:bg-slate-50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <Boxes className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-black text-slate-950">
                      {product.name}
                    </p>

                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getHealthBadge(product)}`}>
                      {getHealthLabel(product)}
                    </span>

                    {product.needs_normalization && (
                      <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        Normalizar
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                    <span>ID: {product.id}</span>
                    <span>Stage: {product.current_stage}</span>
                    <span>Atualizado em {formatSafeDate(product.updated_at)}</span>
                    <span>{product.owners_count} owner(s)</span>
                    <span>{product.collaborators_count} colaborador(es)</span>
                    <span>{product.pending_invites_count} convite(s)</span>
                  </div>

                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {product.access_health_reason}
                  </p>
                </div>

                <div className="w-32">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Evolução do Produto
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {getDisplayProgress(product)}%
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-violet-600"
                      style={{ width: `${getDisplayProgress(product)}%` }}
                    />
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuProductId(openMenuProductId === product.id ? null : product.id);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {openMenuProductId === product.id && (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      className="absolute right-0 top-12 z-[9999] w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/products/${product.id}`);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-4 w-4 text-slate-400" />
                        Abrir workspace
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProduct(product);
                          setOpenMenuProductId(null);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Users className="h-4 w-4 text-slate-400" />
                        Ver detalhes e acessos
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/products/${product.id}?tab=access`);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        Gerenciar acessos
                      </button>

                      <div className="my-1 h-px bg-slate-100" />

                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-700 hover:bg-rose-50"
                      >
                        <Archive className="h-4 w-4" />
                        Arquivar produto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-500">
                  Detalhes administrativos
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedProduct.name}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {selectedProduct.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owners</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{selectedProduct.owners_count}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colaboradores</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{selectedProduct.collaborators_count}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Convites</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{selectedProduct.pending_invites_count}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saúde</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{getHealthLabel(selectedProduct)}</p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-black text-slate-950">Proprietários</h3>
                <div className="mt-3 space-y-2">
                  {selectedProduct.owners.length === 0 ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                      Produto sem proprietário ativo.
                    </p>
                  ) : (
                    selectedProduct.owners.map((owner: any) => (
                      <div key={owner.id || owner.email} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                        {owner.photo_url ? (
                          <img src={owner.photo_url} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <Users className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-black text-slate-950">{owner.display_name || owner.email}</p>
                          <p className="text-xs font-semibold text-slate-500">{owner.email}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-black text-slate-950">Convites pendentes</h3>
                <div className="mt-3 space-y-2">
                  {selectedProduct.pending_invites.length === 0 ? (
                    <p className="rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-500">
                      Nenhum convite pendente.
                    </p>
                  ) : (
                    selectedProduct.pending_invites.map((invite: any) => (
                      <div key={invite.id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-sm font-black text-slate-950">{invite.email}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          Papel: {invite.role || "editor"} · Enviado em {formatShortDate(invite.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
