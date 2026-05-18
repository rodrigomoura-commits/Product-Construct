import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, getDoc, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, limit, where, Timestamp } from 'firebase/firestore';
import { db, cleanFirestoreData, auth } from '../../lib/firebase';
import { ScheduledAction, AdminCtx } from '../../types';
import { 
  Clock, Calendar, Plus, Trash2, 
  CheckCircle2, XCircle, Loader2, AlertCircle, 
  Timer, CalendarDays, Archive, RefreshCcw,
  Sparkles, History, Play, Pause, ExternalLink,
  FileText, X, AlertTriangle, Info, Settings,
  MoreVertical, Copy, ShieldCheck, Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getTimestampMs, formatDateTime, formatDuration } from '../../lib/dateFormat';
import { 
  pauseSchedulerJob, 
  resumeSchedulerJob, 
  updateSchedulerFrequency, 
  disableSchedulerJob,
  updateJobConfig
} from '../../lib/scheduler/schedulerActions';
import {
  canEditSchedulerJob,
  canPauseSchedulerJob,
  canRunSchedulerJob,
  canDeleteSchedulerJob
} from '../../lib/scheduler/schedulerPermissions';
import toast from 'react-hot-toast';
import { useSchedulerRuns, SchedulerRunFilters } from '../../hooks/useSchedulerRuns';
import { useAdminSchedulerRunner } from '../../hooks/useAdminSchedulerRunner';
import { SchedulerRunsFilters } from '../../components/admin/scheduler/SchedulerRunsFilters';
import { SchedulerRunsTable } from '../../components/admin/scheduler/SchedulerRunsTable';

const JOB_FREQUENCY_PRESETS = [
  { label: "A cada 1 minuto", interval_minutes: 1 },
  { label: "A cada 5 minutos", interval_minutes: 5 },
  { label: "A cada 15 minutos", interval_minutes: 15 },
  { label: "A cada 30 minutos", interval_minutes: 30 },
  { label: "A cada 1 hora", interval_minutes: 60 },
  { label: "A cada 6 horas", interval_minutes: 360 },
  { label: "A cada 12 horas", interval_minutes: 720 },
  { label: "Diariamente", interval_minutes: 1440 }
];

function MetricChip({ label, value, tone = 'default' }: { label: string, value: number, tone?: 'default' | 'success' | 'info' | 'danger' | 'warning' }) {
  const tones = {
    default: "bg-zinc-100 text-zinc-600 border-zinc-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    info: "bg-indigo-50 text-indigo-700 border-indigo-100",
    danger: "bg-red-50 text-red-700 border-red-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100"
  };

  if (value === 0 && tone === 'default') return null;

  return (
    <div className={cn("px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-tight flex items-center gap-1", tones[tone])}>
      <span>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function isRunStuck(run: any) {
  if (run.status !== "running") return false;

  const heartbeat = getTimestampMs(run.heartbeat_at, run.heartbeat_at_ms);
  const started = getTimestampMs(run.started_at, run.started_at_ms);

  const base = heartbeat || started;
  if (!base) return false;

  // If running for more than 3 minutes without heartbeat update
  return Date.now() - base > 3 * 60 * 1000;
}

function getRunStatusView(run: any) {
  if (isRunStuck(run)) {
    return {
      label: "STUCK",
      className: "bg-red-100 text-red-700 border-red-200",
      description: "Possivelmente travado"
    };
  }

  const status = String(run.status || "unknown").toLowerCase();

  const map: any = {
    running: {
      label: "RODANDO",
      className: "bg-amber-50 text-amber-700 border-amber-100",
      description: "Executando agora"
    },
    success: {
      label: "SUCESSO",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100",
      description: "Finalizado com sucesso"
    },
    partial: {
      label: "PARCIAL",
      className: "bg-orange-50 text-orange-700 border-orange-100",
      description: "Finalizado com alertas"
    },
    error: {
      label: "ERRO",
      className: "bg-red-50 text-red-700 border-red-100",
      description: "Falhou na execução"
    }
  };

  return map[status] || {
    label: "DESCONHECIDO",
    className: "bg-slate-50 text-slate-600 border-slate-100",
    description: "Status não identificado"
  };
}

function formatJobFrequency(job: any) {
  if (job.recurrence_type === "fixed_interval" || job.interval_minutes || job.fixed_interval) {
    const minutes = Number(job.interval_minutes || job.fixed_interval || 1);

    if (minutes === 1) return "A cada 1 min";
    if (minutes < 60) return `A cada ${minutes} min`;

    const hours = minutes / 60;
    if (Number.isInteger(hours)) {
      return hours === 1 ? "A cada 1 hora" : `A cada ${hours} horas`;
    }

    return `A cada ${minutes} min`;
  }

  if (job.recurrence_type === "one_time") return "Execução única";

  return "Frequência não configurada";
}

export default function ScheduleAdminSection({ ctx, user }: { ctx: AdminCtx, user: any }) {
  const [actions, setActions] = useState<ScheduledAction[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-runner for administrative automation
  useAdminSchedulerRunner(Boolean(ctx?.isOwner || ctx?.isAdmin), user, jobs);

  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [newType, setNewType] = useState<ScheduledAction['type']>('artifact_generation');
  const [newTime, setNewTime] = useState('');
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [pausingJob, setPausingJob] = useState<any>(null);
  const [resumingJob, setResumingJob] = useState<any>(null);
  const [configJob, setConfigJob] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [newInterval, setNewInterval] = useState(1);
  const [newConfigJson, setNewConfigJson] = useState("");
  const [editingAction, setEditingAction] = useState<ScheduledAction | null>(null);

  const [runFilters, setRunFilters] = useState<SchedulerRunFilters>({
    status: "all",
    jobId: "all",
    onlyErrors: false,
    period: "all" as const,
    search: ""
  });

  function displaySafeLogMessage(message: string) {
    const text = String(message || "");
    if (text.includes("PayloadTooLargeError")) {
      return "PayloadTooLargeError: o payload enviado para a IA está grande demais. O job precisa usar payload compacto e runtime JSON leve.";
    }
    if (text.includes("<!DOCTYPE html>")) {
      return "Erro HTML retornado pelo runtime da IA. O conteúdo bruto foi ocultado para preservar a leitura.";
    }
    return text.replace(/<[^>]*>/g, " ").slice(0, 1000);
  }

  const {
    runs,
    allRuns,
    loading: runsLoading,
    error: runsError,
    lastUpdatedAt
  } = useSchedulerRuns(runFilters, 6);

  const safeRuns = Array.isArray(runs) ? runs : [];
  const safeAllRuns = Array.isArray(allRuns) ? allRuns : [];

  useEffect(() => {
    // Ensure default job exists
    const ensureDefaultJob = async () => {
      const canManageScheduler = Boolean(ctx?.isOwner || ctx?.isAdmin);
      if (!canManageScheduler) return;

      try {
        const jobRef = doc(db, "scheduler_jobs", "stage_closure_auto_summary");
        const snap = await getDoc(jobRef);

        if (snap.exists()) {
          // If exists, do NOT overwrite interval_minutes or next_run_at_ms
          await setDoc(
            jobRef,
            cleanFirestoreData({
              id: "stage_closure_auto_summary",
              name: "Resumo inteligente de etapas finalizadas",
              description: "Gera ou atualiza automaticamente o resumo inteligente de etapas concluídas.",
              type: "stage_closure_summary",
              category: "system",
              system_job: true,
              allow_owner_edit: true,
              allow_admin_edit: false,
              allow_manual_run: true,
              allow_pause: true,
              allow_delete: false,
              updated_at: serverTimestamp()
            }),
            { merge: true }
          );
        } else {
          // If NOT exists, set defaults
          const nowMs = Date.now();
          const intervalMinutes = 1;
          const nextMs = nowMs + (intervalMinutes * 60 * 1000);

          await setDoc(
            jobRef,
            cleanFirestoreData({
              id: "stage_closure_auto_summary",
              name: "Resumo inteligente de etapas finalizadas",
              description: "Gera ou atualiza automaticamente o resumo inteligente de etapas concluídas.",
              type: "stage_closure_summary",
              category: "system",
              system_job: true,
              status: "active",
              recurrence_type: "fixed_interval",
              interval_minutes: intervalMinutes,
              next_run_at: Timestamp.fromMillis(nextMs),
              next_run_at_ms: nextMs,
              allow_owner_edit: true,
              allow_admin_edit: false,
              allow_manual_run: true,
              allow_pause: true,
              allow_delete: false,
              created_by: "system",
              created_at: serverTimestamp(),
              created_at_ms: nowMs,
              updated_at: serverTimestamp(),
              updated_at_ms: nowMs
            })
          );
        }
      } catch (error: any) {
        console.error("[ScheduleAdmin] ensureDefaultJob failed", error);
        // Silently fail or minimal toast
      }
    };
    ensureDefaultJob();

    // Stats and subscriptions
    const unsubActions = onSnapshot(
        collection(db, "scheduled_actions"),
        (snap) => {
            const actions = snap.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data()
            } as ScheduledAction));

            const sortedActions = actions.sort((a: any, b: any) => {
                const aTime = Number(a.scheduled_at_ms || a.schedule_time_ms || a.created_at_ms || 0);
                const bTime = Number(b.scheduled_at_ms || b.schedule_time_ms || b.created_at_ms || 0);
                return aTime - bTime;
            });
            setActions(sortedActions);
            setLoading(false);
            setActionsError(null);
        },
        (error: any) => {
            console.error("[ScheduleAdmin] scheduled_actions listener failed", error);
            setActions([]);
            setLoading(false);
            setActionsError(`Erro ao carregar ações agendadas: ${error?.code || error?.message || error}`);
        }
    );

    const unsubJobs = onSnapshot(
        collection(db, 'scheduler_jobs'), 
        (snap) => {
            setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (error) => {
            console.error("[ScheduleAdmin] scheduler_jobs listener failed", error);
            setJobs([]);
            setSectionError("Erro ao carregar jobs do agendador");
        }
    );

    const unsubAudit = onSnapshot(
        query(collection(db, 'scheduler_audit_logs'), orderBy('created_at', 'desc'), limit(30)), 
        (snap) => {
            setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (error) => {
            console.error("[ScheduleAdmin] scheduler_audit_logs listener failed", error);
            setAuditLogs([]);
        }
    );

    return () => {
      unsubActions();
      unsubJobs();
      unsubAudit();
    };
  }, []);

  async function handleMarkRunAsFailed(run: any) {
    try {
      await updateDoc(doc(db, "scheduler_runs", run.id), {
        status: "error",
        finished_at: serverTimestamp(),
        finished_at_ms: Date.now(),
        duration_ms: Date.now() - (run.started_at_ms || Date.now()),
        error: "Execução marcada como falha manualmente por estar presa.",
        errors_count: Math.max(1, Number(run.errors_count || 0)),
        updated_at: serverTimestamp()
      });

      toast.success("Execução encerrada como falha.");
    } catch (error: any) {
      toast.error("Erro ao encerrar execução: " + (error?.message || error));
    }
  }

  async function handleRunNow(job: any) {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("Você precisa estar autenticado para executar jobs.");
        return;
      }

      setRunningJobId(job.id);
      const token = await user.getIdToken(true);

      // Helper to parse JSON carefully
      async function parseApiResponse(response: Response) {
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();

        if (contentType.includes("application/json")) {
          try {
            return JSON.parse(text);
          } catch {
            return {
              ok: false,
              error: "invalid-json",
              message: "O servidor retornou JSON inválido."
            };
          }
        }

        if (text.trim().startsWith("<")) {
          return {
            ok: false,
            error: "html-response",
            message:
              "O endpoint do job retornou HTML em vez de JSON. Verifique os logs do servidor.",
            raw_preview: text.slice(0, 300)
          };
        }

        return {
          ok: false,
          error: "non-json-response",
          message: text.slice(0, 500) || "Resposta não JSON recebida do servidor."
        };
      }

      const response = await fetch("/api/admin/scheduler/run-stage-closure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          job_id: job.id,
          trigger: "manual"
        })
      });

      const payload = await parseApiResponse(response);

      if (payload?.error === "firebase-admin-not-configured") {
        throw new Error(
          "Firebase Admin SDK sem Service Account. Configure FIREBASE_SERVICE_ACCOUNT para permitir execução server-side do job."
        );
      }

      if (
        String(payload?.message || "").includes("PERMISSION_DENIED") ||
        String(payload?.message || "").includes("Missing or insufficient permissions")
      ) {
        throw new Error(
          "O servidor ainda está sem permissão admin real no Firestore. Verifique FIREBASE_SERVICE_ACCOUNT e permissões IAM da service account."
        );
      }

      if (!response.ok || payload?.error || payload?.ok === false) {
        throw new Error(
          payload?.message ||
          payload?.error ||
          `Falha ao executar job. HTTP ${response.status}`
        );
      }

      toast.success(
        `Job executado com sucesso.`
      );
    } catch (e: any) {
      console.error("[Scheduler] Manual run failed", e);
      toast.error("Erro ao executar job: " + (e?.message || e));
    } finally {
      setRunningJobId(null);
    }
  }

  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  async function runSchedulerDiagnostic() {
    try {
      if (!user) {
        toast.error("Você precisa estar logado.");
        return;
      }
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/scheduler/diagnostic", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await response.json();
      
      setDiagnosticResult(payload);
      console.table(payload);
      
      if (payload?.firebase_admin?.has_service_account === false) {
        toast.error("Firebase Admin sem Service Account. Jobs não vão executar.");
        return;
      }
      if (!payload.job_exists && !payload.job?.exists) {
        toast.error("Job padrão não existe.");
        return;
      }
      if (payload.job_status !== "active" && payload.job?.status !== "active") {
        toast.error("Job não está ativo.");
        return;
      }
      if (!payload.due_now && !payload.job?.due_now) {
        toast.success("Scheduler saudável. Job ainda não venceu.");
        return;
      }
      toast.success("Scheduler saudável. Job está pronto para executar.");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao rodar diagnóstico");
    }
  }

  async function handleDuplicateJob(job: any) {
    const newId = `${job.id}_copy_${Date.now().toString().slice(-4)}`;
    try {
      await setDoc(doc(db, "scheduler_jobs", newId), cleanFirestoreData({
        ...job,
        id: newId,
        name: `${job.name} (Cópia)`,
        system_job: false, // Copies are never system jobs
        category: "custom",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: ctx.userId,
        status: "paused", // Always start copied jobs as paused for safety
        last_run_at: null,
        last_status: null,
        last_result: null
      }));
      toast.success(`Job duplicado com sucesso: ${newId}`);
    } catch (e) {
      toast.error("Erro ao duplicar job.");
    }
  }

  async function handleDisableJob(jobId: string) {
    try {
      await disableSchedulerJob({ jobId, user });
      toast.success("Job desativado com sucesso.");
    } catch (e) {
      toast.error("Erro ao desativar job.");
    }
  }

  async function handleTogglePause(job: any) {
    if (job.status === 'active') {
      setPausingJob(job);
      setPauseReason("");
    } else {
      setResumingJob(job);
      setNewInterval(job.interval_minutes || 1);
    }
  }

  async function confirmPause() {
    if (!pausingJob) return;
    try {
      await pauseSchedulerJob({ jobId: pausingJob.id, user, reason: pauseReason });
      toast.success("Job pausado com sucesso.");
      setPausingJob(null);
    } catch (e) {
      toast.error("Erro ao pausar job.");
    }
  }

  async function confirmResume() {
    if (!resumingJob) return;
    try {
      await resumeSchedulerJob({ 
        jobId: resumingJob.id, 
        intervalMinutes: newInterval, 
        user: user,
        reason: updateReason 
      });
      toast.success("Job reativado com sucesso.");
      setResumingJob(null);
      setUpdateReason("");
    } catch (e) {
      toast.error("Erro ao reativar job.");
    }
  }

  async function handleUpdateFrequency() {
    if (!editingJob) return;
    try {
      const token = await user.getIdToken(true);

      const response = await fetch("/api/admin/scheduler/update-job-frequency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          job_id: editingJob.id,
          recurrence_type: "fixed_interval",
          interval_minutes: Number(newInterval)
        })
      });

      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { ok: false, message: "Resposta do servidor não é JSON." };
      }

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || payload.error || "Erro ao atualizar frequência.");
      }

      toast.success(`Frequência atualizada para ${newInterval} min.`);
      setEditingJob(null);
      setUpdateReason("");
    } catch (e: any) {
      toast.error("Erro ao atualizar frequência: " + (e?.message || String(e)));
    }
  }

  async function handleSaveConfig() {
    if (!configJob) return;
    try {
      const parsed = JSON.parse(newConfigJson);
      await updateJobConfig({ jobId: configJob.id, config: parsed, user: user });
      toast.success("Configuração atualizada.");
      setConfigJob(null);
    } catch (e) {
      toast.error("JSON inválido.");
    }
  }

  async function handleCreate() {
    if (!newTime) return;
    try {
      await addDoc(collection(db, 'scheduled_actions'), {
        type: newType,
        status: 'scheduled',
        schedule_time: new Date(newTime),
        product_id: 'global',
        created_by: ctx.userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        payload: { reason: "Manual admin schedule" }
      });
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCancel(id: string) {
    try {
      await updateDoc(doc(db, 'scheduled_actions', id), { 
        status: 'cancelled', 
        updated_at: serverTimestamp(),
        cancelled_by: ctx.userId 
      });
      toast.success("Agendamento cancelado.");
    } catch (e) {
      toast.error("Erro ao cancelar.");
    }
  }

  async function handleDuplicateAction(action: ScheduledAction) {
    try {
      const { id, ...data } = action;
      await addDoc(collection(db, 'scheduled_actions'), {
        ...data,
        status: 'scheduled',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: ctx.userId
      });
      toast.success("Agendamento duplicado.");
    } catch (e) {
      toast.error("Erro ao duplicar.");
    }
  }

  async function handleUpdateActionTime() {
    if (!editingAction || !newTime) return;
    try {
      await updateDoc(doc(db, 'scheduled_actions', editingAction.id), {
        schedule_time: new Date(newTime),
        updated_at: serverTimestamp(),
        updated_by: ctx.userId
      });
      toast.success("Horário atualizado.");
      setEditingAction(null);
    } catch (e) {
      toast.error("Erro ao atualizar horário.");
    }
  }

  const successRuns24h = safeRuns.filter(r => 
    r.job_id === 'stage_closure_auto_summary' && 
    (r.status === 'success' || r.status === 'partial') &&
    getTimestampMs(r.started_at, r.started_at_ms) > Date.now() - 24 * 60 * 60 * 1000
  ).length;

  const activeJob = jobs.find(j => j.id === 'stage_closure_auto_summary');
  const isJobRunning = safeRuns.some(r => r.job_id === 'stage_closure_auto_summary' && r.status === 'running' && !isRunStuck(r));
  const stuckCount = safeRuns.filter(r => isRunStuck(r)).length;

  return (
    <div className="space-y-10">
      {sectionError && (
        <div className="rounded-[28px] border border-red-100 bg-red-50 p-5 text-red-700">
          <p className="text-xs font-black uppercase tracking-widest">
            Falha controlada no Agendador
          </p>
          <p className="mt-2 text-sm font-bold">
            {sectionError}
          </p>
          <button
            type="button"
            onClick={() => {
              setSectionError(null);
              window.location.reload();
            }}
            className="mt-4 rounded-2xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
          >
            Recarregar seção
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Agendador IA</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Gerencie ações autônomas e jobs recorrentes de sistema.</p>
        </div>
          <div className="flex gap-2">
            <button 
              onClick={runSchedulerDiagnostic}
              className="bg-white text-zinc-900 border border-zinc-200 px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Activity className="w-5 h-5" /> Diagnóstico
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-zinc-900 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" /> Novo Agendamento
            </button>
          </div>
        </div>

      {diagnosticResult && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-[2rem] border p-6 flex flex-wrap gap-8 items-center justify-between",
            diagnosticResult.firebase_admin?.has_service_account ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50 border-red-100"
          )}
        >
          <div className="flex items-center gap-4">
             <div className={cn(
               "w-12 h-12 rounded-2xl flex items-center justify-center",
               diagnosticResult.firebase_admin?.has_service_account ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
             )}>
                <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Admin SDK Status</p>
                <p className={cn("font-black text-sm", diagnosticResult.firebase_admin?.has_service_account ? "text-emerald-700" : "text-red-700")}>
                  {diagnosticResult.firebase_admin?.has_service_account ? "CONECTADO (Privilegiado)" : "DESCONECTADO (Modo Limitado)"}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <Settings className="w-6 h-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Job Status</p>
                <p className="font-black text-sm text-indigo-700">
                  {diagnosticResult.job?.status?.toUpperCase() || "N/A"}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-zinc-100 text-zinc-600 rounded-2xl flex items-center justify-center">
                <Clock className="w-6 h-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Próxima Execução</p>
                <p className="font-black text-sm text-zinc-700">
                  {formatDateTime(diagnosticResult.job?.next_run_at_ms)}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                diagnosticResult.job?.due_now ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
              )}>
                 <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Vencido Agora</p>
                 <p className={cn("font-black text-sm", diagnosticResult.job?.due_now ? "text-amber-700" : "text-emerald-700")}>
                   {diagnosticResult.job?.due_now ? "SIM (Aguardando)" : "NÃO"}
                 </p>
              </div>
          </div>

          <button 
            onClick={() => setDiagnosticResult(null)}
            className="p-2 hover:bg-zinc-200/50 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", activeJob?.status === 'active' ? "bg-indigo-50 text-indigo-600" : "bg-zinc-100 text-zinc-400")}>
               <Timer className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Status do Resumo</p>
               <p className="font-black text-xl text-zinc-900">
                 {isJobRunning ? 'RODANDO' : activeJob?.status === 'active' ? `ATIVO (${formatJobFrequency(activeJob)})` : activeJob?.status === 'paused' ? 'PAUSADO' : 'N/A'}
               </p>
               {stuckCount > 0 && <p className="text-[9px] font-bold text-red-500 uppercase mt-0.5">{stuckCount} possivelmente travado(s)</p>}
            </div>
         </div>
         <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
               <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Concluídas (24h)</p>
               <p className="font-black text-xl text-zinc-900">{successRuns24h} ciclos</p>
               {isJobRunning && <p className="text-[9px] font-bold text-amber-600 uppercase mt-0.5">1 em execução agora</p>}
            </div>
         </div>
         <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
               <RefreshCcw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Recorrências</p>
               <p className="font-black text-xl text-zinc-900">{jobs.length} Ativas</p>
            </div>
         </div>
      </div>

      <div className="flex items-center gap-4 border-b border-zinc-100 pb-1 shrink-0">
        <button 
          onClick={() => setShowAudit(false)}
          className={cn(
            "pb-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all",
            !showAudit ? "text-zinc-900 border-zinc-900" : "text-zinc-400 border-transparent"
          )}
        >
          Jobs e Frequências
        </button>
        <button 
          onClick={() => setShowAudit(true)}
          className={cn(
            "pb-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all",
            showAudit ? "text-zinc-900 border-zinc-900" : "text-zinc-400 border-transparent"
          )}
        >
          Auditoria e Logs
        </button>
      </div>

      {!showAudit && (
        <div className="space-y-6">
          <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5" /> Jobs de Sistema
          </h3>
          <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-visible shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ação / Tipo</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Frequência</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Próxima / Última</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Resultado</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-zinc-50/50 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          job.system_job ? "bg-indigo-50 text-indigo-600" : "bg-teal-50 text-teal-600"
                        )}>
                          {job.system_job ? <ShieldCheck className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-zinc-900 leading-tight">{job.name}</p>
                            {job.system_job && <span className="px-1.5 py-0.5 bg-indigo-50 text-[8px] font-black text-indigo-600 rounded-md border border-indigo-100">SYSTEM</span>}
                          </div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">{job.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase border",
                        job.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                        job.status === 'paused' ? "bg-amber-50 text-amber-700 border-amber-100" :
                        "bg-zinc-100 text-zinc-500 border-zinc-200"
                      )}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-bold text-zinc-900 text-sm">{formatJobFrequency(job)}</p>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{job.recurrence_type || 'fixed_interval'}</p>
                    </td>
                    <td className="px-8 py-6">
                       <div className="space-y-1">
                          <p className="text-[10px] font-bold text-zinc-600">Próxima: <span className="text-zinc-900">{formatDateTime(job.next_run_at)}</span></p>
                          <p className="text-[10px] font-bold text-zinc-400">Última: <span className="text-zinc-500">{formatDateTime(job.last_run_at)}</span></p>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                      {job.last_result ? (
                        <div>
                          <div className="flex flex-wrap gap-1 mb-1">
                             <MetricChip label="C" value={job.last_result.summaries_created} tone="success" />
                             <MetricChip label="U" value={job.last_result.summaries_updated} tone="info" />
                             <MetricChip label="S" value={job.last_result.summaries_skipped} />
                          </div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Último resultado</p>
                        </div>
                      ) : (
                        <p className="text-zinc-300 italic text-xs">Sem execuções</p>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canRunSchedulerJob((ctx.isOwner ? 'owner' : (ctx.isAdmin ? 'admin' : 'user')), job) && (
                          <button 
                            onClick={() => handleRunNow(job)}
                            disabled={runningJobId === job.id}
                            className="p-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all disabled:opacity-50"
                            title="Executar agora"
                          >
                            {runningJobId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                          </button>
                        )}
                        {canPauseSchedulerJob((ctx.isOwner ? 'owner' : (ctx.isAdmin ? 'admin' : 'user')), job) && (
                          <button 
                            onClick={() => handleTogglePause(job)}
                            className="p-2.5 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-all"
                            title={job.status === 'active' ? 'Pausar' : 'Retomar'}
                          >
                            {job.status === 'active' ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                          </button>
                        )}
                        {canEditSchedulerJob((ctx.isOwner ? 'owner' : (ctx.isAdmin ? 'admin' : 'user')), job) && (
                          <button 
                            onClick={() => {
                              setEditingJob(job);
                              setNewInterval(job.interval_minutes || 1);
                            }}
                            className="p-2.5 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-all"
                            title="Editar Frequência"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                        <div className="relative group/more">
                           <button 
                             className="p-2.5 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-all"
                             title="Mais Opções"
                           >
                             <MoreVertical className="w-4 h-4" />
                           </button>
                           <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-zinc-100 py-2 hidden group-hover/more:block z-20 overflow-hidden ring-1 ring-black/5">
                              <button 
                                onClick={() => {
                                  setConfigJob(job);
                                  setNewConfigJson(JSON.stringify(job.config || {}, null, 2));
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                              >
                                 <FileText className="w-3.5 h-3.5 text-indigo-500" /> Configuração JSON
                              </button>
                              <button 
                                onClick={() => handleDuplicateJob(job)}
                                className="w-full px-4 py-2.5 text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                              >
                                 <Copy className="w-3.5 h-3.5 text-emerald-500" /> Duplicar Job
                              </button>
                              
                              {job.status !== 'disabled' ? (
                                <button 
                                  onClick={() => handleDisableJob(job.id)}
                                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                >
                                   <Trash2 className="w-3.5 h-3.5" /> Desativar Job
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleTogglePause(job)}
                                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                >
                                   <RefreshCcw className="w-3.5 h-3.5" /> Ativar Job
                                </button>
                              )}
                              <div className="h-px bg-zinc-100 my-1" />
                              <button 
                                onClick={() => {
                                  setShowAudit(true);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                              >
                                 <History className="w-3.5 h-3.5 text-slate-500" /> Ver Auditoria
                              </button>
                           </div>
                        </div>
                      </div>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAudit && (
        <div className="space-y-6">
          <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5" /> Auditoria do Agendador
          </h3>
          <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
             <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Data / Hora</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Job</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ação</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ator</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-xs font-bold text-zinc-900">{formatDateTime(log.created_at)}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">{log.job_id}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-700 text-[9px] font-black uppercase rounded-lg border border-zinc-200">
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-xs font-medium text-zinc-600">{log.actor_email}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-xs text-zinc-500 italic">
                          {log.interval_minutes ? `Frequência: ${log.interval_minutes}m` : log.reason || '-'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5" /> Histórico de Execuções
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Atualização automática em tempo real
              {lastUpdatedAt ? ` · Última atualização: ${lastUpdatedAt.toLocaleTimeString("pt-BR")}` : ""}
            </p>
            <p className="text-[10px] font-mono text-zinc-400 mt-1">
              Debug: All: {safeAllRuns.length} | Filtered: {safeRuns.length}
            </p>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
            Tempo real
          </span>
        </div>

        <SchedulerRunsFilters
          filters={runFilters}
          setFilters={setRunFilters}
          jobs={jobs}
        />

        <SchedulerRunsTable
          runs={safeRuns}
          loading={runsLoading}
          onViewLogs={(run: any) => setSelectedRun(run)}
          onMarkAsFailed={handleMarkRunAsFailed}
        />

        {!safeRuns.length && safeAllRuns.length > 0 && (
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center shadow-sm mt-4">
            <p className="text-sm font-bold text-slate-700">Nenhuma execução encontrada com os filtros atuais.</p>
            <button
              onClick={() => setRunFilters({ status: "all", jobId: "all", onlyErrors: false, period: "all", search: "" })}
              className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Modal Editar Frequência */}
      <AnimatePresence>
        {editingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl relative w-full max-w-lg p-8 overflow-hidden flex flex-col border border-zinc-200"
            >
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-6">Editar Frequência</h2>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Job Selecionado</p>
                  <p className="font-bold text-zinc-900 text-lg leading-tight">{editingJob.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Intervalo</label>
                    <select 
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold text-sm"
                      value={newInterval}
                      onChange={e => setNewInterval(Number(e.target.value))}
                    >
                      {JOB_FREQUENCY_PRESETS.map(p => (
                        <option key={p.interval_minutes} value={p.interval_minutes}>{p.label}</option>
                      ))}
                      <option value="custom">Customizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Próxima Execução</label>
                    <div className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-500">
                       {formatDateTime(Date.now() + newInterval * 60000)}
                    </div>
                  </div>
                </div>

                {(!JOB_FREQUENCY_PRESETS.some(p => p.interval_minutes === newInterval)) && (
                   <div>
                     <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Minutos (Custom)</label>
                     <input 
                       type="number"
                       className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                       value={newInterval}
                       onChange={e => setNewInterval(Number(e.target.value))}
                       min={1}
                       max={10080}
                     />
                   </div>
                )}

                <div>
                   <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Motivo da Alteração (Opcional)</label>
                   <textarea 
                     className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-medium text-sm min-h-[80px]"
                     placeholder="Ex: Aumentando frequência para acompanhar volume de dados..."
                     value={updateReason}
                     onChange={e => setUpdateReason(e.target.value)}
                   />
                </div>

                <div className="flex gap-4">
                   <button onClick={() => { setEditingJob(null); setUpdateReason(""); }} className="flex-1 py-4 bg-zinc-100 rounded-2xl font-black text-sm transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={handleUpdateFrequency} className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-black text-sm transition-all hover:bg-zinc-700 shadow-lg">Salvar Frequência</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Pausar Job */}
      <AnimatePresence>
        {pausingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl relative w-full max-w-lg p-8 overflow-hidden flex flex-col border border-zinc-200"
            >
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-2">Pausar Job</h2>
              <p className="text-zinc-500 text-sm font-medium mb-6">Este job deixará de executar automaticamente até ser reativado.</p>
              
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Job</p>
                  <p className="font-bold text-zinc-900">{pausingJob.name}</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Motivo da Pausa (opcional)</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm font-medium min-h-[100px]"
                    placeholder="Ex: Debugando comportamento, manutencao..."
                    value={pauseReason}
                    onChange={e => setPauseReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setPausingJob(null)} className="flex-1 py-4 bg-zinc-100 rounded-2xl font-black text-sm transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={confirmPause} className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black text-sm transition-all hover:bg-amber-700">Pausar Job</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Reativar Job */}
      <AnimatePresence>
        {resumingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl relative w-full max-w-lg p-8 overflow-hidden flex flex-col border border-zinc-200"
            >
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-2">Reativar Job</h2>
              <p className="text-zinc-500 text-sm font-medium mb-6">Este job voltará a executar automaticamente conforme a frequência configurada.</p>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Job</p>
                  <p className="font-bold text-zinc-900">{resumingJob.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Frequência</label>
                    <input 
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                      value={newInterval}
                      onChange={e => setNewInterval(Number(e.target.value))}
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Próxima Execução</label>
                    <div className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-500">
                       {formatDateTime(Date.now() + newInterval * 60000)}
                    </div>
                  </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Motivo da Reativação (Opcional)</label>
                   <textarea 
                     className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-medium text-sm min-h-[80px]"
                     placeholder="Ex: Manutenção finalizada, voltando ao fluxo normal..."
                     value={updateReason}
                     onChange={e => setUpdateReason(e.target.value)}
                   />
                </div>

                <div className="flex gap-4">
                   <button onClick={() => { setResumingJob(null); setUpdateReason(""); }} className="flex-1 py-4 bg-zinc-100 rounded-2xl font-black text-sm transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={confirmResume} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm transition-all hover:bg-emerald-700 shadow-lg">Reativar Agora</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Configuração */}
      <AnimatePresence>
        {configJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl relative w-full max-w-2xl p-8 overflow-hidden flex flex-col border border-zinc-200"
            >
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-2">Configuração do Job</h2>
              <p className="text-zinc-500 text-sm font-medium mb-6">Visualização e edição avançada de parâmetros internos.</p>
              
              <div className="space-y-6 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                      <p className="text-[9px] font-black uppercase text-zinc-400">ID</p>
                      <p className="text-xs font-bold text-zinc-900 font-mono tracking-tighter truncate">{configJob.id}</p>
                   </div>
                   <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                      <p className="text-[9px] font-black uppercase text-zinc-400">Status</p>
                      <p className="text-xs font-bold text-zinc-900 tracking-tight">{configJob.status.toUpperCase()}</p>
                   </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Config JSON</label>
                  <textarea 
                    className="flex-1 w-full px-4 py-3 bg-zinc-900 text-emerald-400 font-mono text-xs rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none min-h-[300px]"
                    value={newConfigJson}
                    onChange={e => setNewConfigJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setConfigJob(null)} className="flex-1 py-4 bg-zinc-100 rounded-2xl font-black text-sm transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={handleSaveConfig} className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-black text-sm transition-all hover:bg-zinc-800">Salvar Parâmetros</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Ações Agendadas Pontuais
        </h3>
        <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">

           {actionsError ? (
            <div className="rounded-[28px] border border-red-100 bg-red-50 p-8 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-red-600">
                Falha ao carregar ações pontuais
              </p>
              <p className="mt-2 text-sm font-bold text-red-700">
                {actionsError}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActionsError(null);
                  window.location.reload();
                }}
                className="mt-4 rounded-2xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
              >
                Tentar novamente
              </button>
            </div>
           ) : (
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="border-b border-zinc-100 bg-zinc-50/50">
                      <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ação / Tipo</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Scheduled Time</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Ações</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                   {loading ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                           <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-200" />
                        </td>
                      </tr>
                   ) : actions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                           <p className="text-zinc-500 font-medium italic">Nenhuma ação agendada encontrada.</p>
                        </td>
                      </tr>
                   ) : actions.map(action => (
                      <tr key={action.id} className="hover:bg-zinc-50/50 transition-colors group">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                 action.status === 'scheduled' ? "bg-zinc-100 text-zinc-900" : "bg-slate-50 text-slate-400"
                               )}>
                                  <CalendarDays className="w-5 h-5" />
                               </div>
                               <div>
                                  <p className="font-bold text-zinc-900 leading-tight">{action.type.replace('_', ' ')}</p>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">{action.product_id}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase border",
                              action.status === 'scheduled' ? "bg-amber-50 text-amber-700 border-amber-100" :
                              action.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                              "bg-zinc-100 text-zinc-500 border-zinc-200"
                            )}>
                               {action.status}
                            </span>
                         </td>
                         <td className="px-8 py-6">
                            <p className="font-bold text-zinc-900 text-sm">{formatDateTime(action.schedule_time)}</p>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Execução estimada</p>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                               {action.status === 'scheduled' && (
                                 <>
                                   <button 
                                     onClick={() => {
                                       setEditingAction(action);
                                       setNewTime(new Date(getTimestampMs(action.schedule_time)).toISOString().slice(0, 16));
                                     }}
                                     className="p-2 text-zinc-400 hover:text-indigo-600 transition-colors"
                                     title="Editar Horário"
                                   >
                                      <Clock className="w-5 h-5" />
                                   </button>
                                   <button 
                                     onClick={() => handleCancel(action.id)}
                                     className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                                     title="Cancelar"
                                   >
                                      <XCircle className="w-5 h-5" />
                                   </button>
                                 </>
                               )}
                               <button 
                                 onClick={() => handleDuplicateAction(action)}
                                 className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                                 title="Duplicar"
                               >
                                  <Copy className="w-5 h-5" />
                               </button>
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
           )}
        </div>
      </div>


      {/* Modal Logs da Execução */}
      <AnimatePresence>
        {selectedRun && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-zinc-200"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between shrink-0">
                <div>
                   <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                     <FileText className="w-6 h-6 text-indigo-600" /> Logs da Execução
                   </h2>
                   <p className="text-zinc-500 text-sm font-medium mt-1">Detalhes operacionais do Job {selectedRun.job_id.toUpperCase()}</p>
                </div>
                <button 
                  onClick={() => setSelectedRun(null)}
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-zinc-50/30">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Status Final</p>
                    <p className="font-bold text-zinc-900">{selectedRun.status.toUpperCase()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Duração Total</p>
                    <p className="font-bold text-zinc-900">{formatDuration(selectedRun.duration_ms)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Início</p>
                    <p className="font-bold text-zinc-900">{formatDateTime(selectedRun.started_at, selectedRun.started_at_ms)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Fim</p>
                    <p className="font-bold text-zinc-900">{formatDateTime(selectedRun.finished_at, selectedRun.finished_at_ms)}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3">Timeline de Operação</p>
                  <div className="space-y-3">
                    {selectedRun.logs && selectedRun.logs.length > 0 ? selectedRun.logs.map((log: any, idx: number) => (
                      <div key={idx} className="flex gap-4 group">
                        <div className="shrink-0 w-32 font-mono text-[10px] text-zinc-400 pt-1">
                          {formatDateTime(log.created_at || log.created_at_ms).split(' ')[1]}
                        </div>
                        <div className={cn(
                          "flex-1 p-3 rounded-xl border flex items-start gap-3",
                          log.level === 'error' ? "bg-red-50 border-red-100 text-red-700" :
                          log.level === 'warn' ? "bg-amber-50 border-amber-100 text-amber-700" :
                          "bg-white border-zinc-100 text-zinc-600"
                        )}>
                          {log.level === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : 
                           log.level === 'warn' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : 
                           <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />}
                          <p className="text-xs font-medium leading-relaxed">{displaySafeLogMessage(log.message)}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-zinc-400 italic text-sm text-center py-6 bg-white rounded-2xl border border-zinc-100">Sem logs detalhados para esta execução.</p>
                    )}
                  </div>
                </div>

                {(selectedRun.errors && selectedRun.errors.length > 0) && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-red-400 tracking-widest mb-3">Erros Detectados ({selectedRun.errors.length})</p>
                    <div className="space-y-3">
                      {selectedRun.errors.map((err: any, idx: number) => (
                        <div key={idx} className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                          <p className="text-xs font-black text-red-900 mb-1">Erro na Operação</p>
                          <p className="text-xs text-red-700 font-medium">{displaySafeLogMessage(err.message)}</p>
                          {err.product_id && (
                            <div className="mt-2 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                              Produto: {err.product_id} · Etapa: {err.stage_id}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-zinc-100 shrink-0 bg-white">
                 <button 
                   onClick={() => setSelectedRun(null)}
                   className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-sm hover:bg-zinc-800 transition-all shadow-lg"
                 >
                   Fechar Visualização
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Ação Pontual */}
      <AnimatePresence>
        {editingAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setEditingAction(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl relative w-full max-w-lg p-8 overflow-hidden z-20"
            >
              <h2 className="text-2xl font-bold tracking-tight mb-2">Editar Agendamento</h2>
              <p className="text-zinc-500 text-sm mb-6 font-medium italic">Altere o horário estimado para esta operação.</p>
              
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1 text-left">Ação</p>
                  <p className="font-bold text-zinc-900 text-left">{editingAction.type.replace('_', ' ')} · {editingAction.product_id}</p>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-400 tracking-widest mb-2 text-left">Novo Horário Estimado</label>
                  <input 
                    type="datetime-local"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setEditingAction(null)} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={handleUpdateActionTime} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all hover:bg-zinc-800">Atualizar Horário</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Novo Agendamento */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl relative w-full max-w-lg p-8 overflow-hidden"
            >
              <h2 className="text-2xl font-bold tracking-tight mb-6">Nova Ação Agendada</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-400 tracking-widest mb-2 text-left">Tipo de Ação</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                  >
                    <option value="artifact_generation">Gerar Artefato</option>
                    <option value="memory_sync">Sincronizar Memória</option>
                    <option value="maturity_check">Verificar Maturidade</option>
                    <option value="user_nudge">Enviar Notificação/Nudge</option>
                    <option value="market_research">Pesquisa de Mercado IA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-400 tracking-widest mb-2 text-left">Data/Hora Estimada</label>
                  <input 
                    type="datetime-local"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={handleCreate} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all hover:bg-zinc-800">Agendar Ação</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
