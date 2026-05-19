import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Product, ProductStage, StageKey, StageField, ConversationMemory, StageClosureSynthesis, ReopenDiscussionState } from '../../types';
import StageReopenDiscussionCard from './StageReopenDiscussionCard';
import { 
  Bot, Send, Loader2, Sparkles, User, 
  MessageSquare, ChevronDown, CheckCircle2, 
  AlertCircle, Zap, RefreshCw, Layers, Paperclip,
  ArrowRight, Brain, Lightbulb, Check, ShieldAlert,
  Terminal, Activity, Lock, Database, Eye
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, cleanFirestoreData } from '../../lib/firebase';
import { isStageCompleted, syncProductEvolutionCache, touchStage } from '../../lib/progressEngine';
import { cleanConversationSummaryForDisplay, removeStaleMaturityMentions } from '../../lib/summarySanitizer';
import { retrieveMindflowContext, extractMindflowLearning } from '../../lib/mindflow';
import { storeUserMemory } from '../../lib/mindflowContext';
import { OptionSelectionBlock } from './OptionSelectionBlock';
import { saveConversationMessage, getRecentConversationMessages } from '../../lib/conversationHistory';
import { recordProductInteraction } from '../../lib/productUserInteractions';

import { runTonaConversationTurn, MindflowTurnResult } from '../../lib/tonaRuntime';
import { uploadProductDocument, ProductDocumentUploadProgress } from '../../lib/productDocuments';
import { getProductMemoriesCollection, getProductInteractionsCollection, getProductSynthesisCollection } from '../../lib/mindflowCollections';
import { increment, onSnapshot, orderBy, limit } from 'firebase/firestore';
import StageCompletedConversationSummary from './StageCompletedConversationSummary';
import { generateStageClosureWithAI } from '../../lib/stageClosureAI';
import { saveStageClosure, getStageClosure } from '../../lib/stageClosureService';
import toast from 'react-hot-toast';

function normalizeProgress(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getStageProgress(stage: any) {
  return normalizeProgress(
    stage?.progress ??
    stage?.maturity ??
    stage?.quality_score ??
    0
  );
}

function isStageCompletedHelper(stage: any) {
  return (
    getStageProgress(stage) >= 100 ||
    stage?.status === "completed" ||
    stage?.is_completed === true
  );
}

function evaluateConversationStopCriteria(context: any) {
  const questionCount = context.thread?.question_count || 0;
  const maturity = Number(context.stage?.maturity || 0);
  const message = String(context.last_user_message || "").toLowerCase();

  const userWantsAction =
    message.includes("atualizar") ||
    message.includes("seguir") ||
    message.includes("avançar") ||
    message.includes("fechar") ||
    message.includes("gerar") ||
    message.includes("pode");

  const hasEnoughSignals = (context.collected_signals || []).length >= 2;
  const hasFewUncertainties = (context.open_uncertainties || []).length <= 1;

  if (userWantsAction) {
    return {
      shouldAskMore: false,
      shouldStopQuestions: true,
      stopReason: "user_requested_action",
      nextActionType: "wait_user_choice",
      suggestedActions: [
        "Atualizar resumo inteligente",
        "Continuar rediscutindo",
        "Manter como pendência"
      ]
    };
  }

  if (context.mode === "reopen_discussion" && questionCount >= 3) {
    return {
      shouldAskMore: false,
      shouldStopQuestions: true,
      stopReason: "max_questions_reached_for_reopen_discussion",
      nextActionType: "summarize",
      suggestedActions: [
        "Atualizar resumo inteligente",
        "Fazer mais uma pergunta",
        "Manter como pendência"
      ]
    };
  }

  if (hasEnoughSignals && hasFewUncertainties) {
    return {
      shouldAskMore: false,
      shouldStopQuestions: true,
      stopReason: "sufficient_context_collected",
      nextActionType: "summarize",
      suggestedActions: [
        "Atualizar memória",
        "Atualizar resumo inteligente",
        "Avançar etapa"
      ]
    };
  }

  if (maturity >= 100 && context.mode !== "reopen_discussion") {
    return {
      shouldAskMore: false,
      shouldStopQuestions: true,
      stopReason: "stage_already_completed",
      nextActionType: "wait_user_choice",
      suggestedActions: [
        "Avançar para próxima etapa",
        "Rediscutir um ponto",
        "Gerar artefato"
      ]
    };
  }

  return {
    shouldAskMore: true,
    shouldStopQuestions: false,
    stopReason: null,
    nextActionType: "ask",
    suggestedActions: []
  };
}

function isTechnicalResumeMessage(message: any) {
  const content = String(message?.content || "").toLowerCase();

  return (
    content.includes("retome a conversa a partir do último estado salvo") ||
    content.includes("retomando de onde paramos") ||
    content.includes("continuar daqui") ||
    content.includes("último estado salvo do produto")
  );
}

function cleanLegacySummary(text: string) {
  return String(text || "")
    .replace(/maturidade em\s*\d{1,3}%\.?/gi, "")
    .replace(/com\s*\d{1,3}%\s*de maturidade\.?/gi, "")
    .replace(/já possui\s*\d+\s*itens salvos\.?/gi, "")
    .replace(/usuário respondeu:/gi, "")
    .replace(/tona orientou:/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDuplicatedOptionsFromContent(content: string, options: any[]) {
  if (!content || !options?.length) return content;

  let cleaned = content;

  for (const opt of options) {
    const letter = opt.letter;
    const label = opt.label;

    if (!letter || !label) continue;

    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns = [
      new RegExp(`\\n?\\s*${letter}[\\)\\.]\\s*${escapedLabel}[\\s\\S]*?(?=\\n\\s*[A-D][\\)\\.]|\\n\\s*Outro caminho|$)`, "gi"),
      new RegExp(`\\n?\\s*${letter}\\s+${escapedLabel}[\\s\\S]*?(?=\\n\\s*[A-D]\\s+|\\n\\s*Outro caminho|$)`, "gi")
    ];

    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, "");
    }
  }

  return cleaned
    .replace(/\n?\s*Outro caminho\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  isError?: boolean;
}

interface BehavioralCheck {
  passed: boolean;
  notes: string;
}

interface StructuredAIResponse {
  assistant_message: string;
  detected_intent: string;
  stage_focus: StageKey;
  situational_product_interpretation: {
    product_name_signals: string[];
    interpreted_product_type: string;
    likely_users: string[];
    likely_problem_hypotheses: string[];
    likely_value_hypotheses: string[];
    likely_risks: string[];
    confidence: number;
  };
  question_strategy: {
    type: "multiple_choice" | "open" | "confirmation" | "contrast" | "tradeoff" | "evidence" | "impact" | "scope";
    reason: string;
    options: Array<{
      id: string;
      letter: string | null;
      label: string;
      title?: string;
      short_label: string;
      description: string;
    }>;
    allows_free_text: boolean;
  };
  behavior_risk_level: 'low' | 'medium' | 'high';
  behavior_check: {
    clarity_check: BehavioralCheck;
    evidence_check: BehavioralCheck;
    care_check: BehavioralCheck;
    inclusion_check: BehavioralCheck;
    human_autonomy_check: BehavioralCheck;
    context_check: BehavioralCheck;
    progression_check: BehavioralCheck;
    safety_check: BehavioralCheck;
  };
  memory_updates: Array<{
    field_key: string;
    label: string;
    value: string;
    classification: 'fact' | 'hypothesis' | 'evidence' | 'decision' | 'risk' | 'pending';
    confidence: number;
    source: 'chat' | 'document' | 'inferred_from_product_name' | 'user_confirmed';
    requires_confirmation?: boolean;
  }>;
  evidence_updates: any[];
  decision_updates: any[];
  risk_updates: any[];
  gap_updates: string[];
  learning_updates: string[];
  maturity_update: {
    stage_key: StageKey;
    previous_score: number;
    new_score: number;
    score_delta: number;
    reason: string;
  };
  conversation_memory_update?: Partial<ConversationMemory>;
  next_best_question: string;
  suggested_quick_actions: string[];
}

interface AIAssistantPanelProps {
  product: Product;
  activeStage: StageKey;
  stages: ProductStage[];
  permissions?: any;
  workspaceAccess?: any;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
  onTabChange?: (tab: 'chat' | 'artifacts' | 'decisions' | 'documents' | 'history') => void;
}

export interface AIAssistantPanelRef {
  resume: () => void;
}

const AIAssistantPanel = forwardRef<AIAssistantPanelRef, AIAssistantPanelProps>(({ 
  product, 
  activeStage, 
  stages, 
  permissions: propPermissions,
  workspaceAccess,
  pendingPrompt, 
  onPendingPromptConsumed, 
  onTabChange 
}, ref) => {
  const { user, profile, adminCtx } = useAuth();
  const workspaceContext = useWorkspace();
  const permissions = propPermissions || workspaceContext?.permissions;
  const userName = profile?.display_name?.split(' ')[0] || 'você';
  const [conversationMemory, setConversationMemory] = useState<ConversationMemory | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [productMemories, setProductMemories] = useState<any[]>([]);
  const [synthesisItems, setSynthesisItems] = useState<any[]>([]);
  const [fields, setFields] = useState<StageField[]>([]);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const isSendingRef = useRef(false);

  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [stageClosure, setStageClosure] = useState<StageClosureSynthesis | null>(null);
  const [generatingClosure, setGeneratingClosure] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);
  const [reopenDiscussion, setReopenDiscussion] = useState<ReopenDiscussionState>({
    mode: "idle",
    stageKey: null,
    category: null,
    itemId: null,
    itemTitle: null,
    itemDescription: null,
    firstQuestionAsked: false
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const completedSummaryRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lastError, setLastError] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<Record<string, ProductDocumentUploadProgress>>({});

  const activeStageObject = stages.find((s) => s.stage_key === activeStage);
  const activeStageProgress = getStageProgress(activeStageObject);
  const stageCompleted = isStageCompletedHelper(activeStageObject);

  const CONVERSATION_TIMEOUT_MS = 45000;

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = "operation"): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label}_TIMEOUT_${timeoutMs}MS`));
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  function removeThinkingPlaceholders() {
    setMessages((prev) =>
      prev.filter((msg) =>
        (msg as any).type !== "thinking" &&
        (msg as any).status !== "pending" &&
        msg.content !== "Tona está organizando o raciocínio..."
      )
    );
  }

  function removeMessage(id: string) {
     // Needs to be implemented if not present, will rely on messages array filtering by ID if I had IDs.
     // For now, removing thinking messages is key as per requirement.
     removeThinkingPlaceholders();
  }

  function normalizeConversationError(error: any) {
    const raw =
      typeof error === "string"
        ? error
        : JSON.stringify(error || {}, Object.getOwnPropertyNames(error));
    const lower = raw.toLowerCase();
    if (lower.includes("monthly spending cap") || lower.includes("resource_exhausted")) {
      return {
        code: "GEMINI_SPEND_CAP_OR_QUOTA",
        userMessage:
          "O projeto atingiu limite de gasto ou quota do Gemini. A conversa pode continuar em modo local, mas chamadas de IA ficam limitadas até o ajuste no AI Studio."
      };
    }
    if (lower.includes("timeout")) {
      return {
        code: "TONA_TIMEOUT",
        userMessage:
          "A Tona demorou demais para responder. Interrompi o processamento para evitar travamento."
      };
    }
    if (lower.includes("payload too large")) {
      return {
        code: "PAYLOAD_TOO_LARGE",
        userMessage:
          "O contexto enviado ficou grande demais. Vou continuar com uma versão compactada da memória."
      };
    }
    if (lower.includes("permission_denied") || lower.includes("missing or insufficient permissions")) {
      return {
        code: "PERMISSION_DENIED",
        userMessage:
          "Ocorreu uma falha de permissão ao consultar ou salvar dados. O contexto local foi preservado."
      };
    }
    return {
      code: "UNKNOWN_CONVERSATION_ERROR",
      userMessage:
        "Tive um problema ao processar a resposta, mas o contexto da conversa foi preservado."
    };
  }

  useEffect(() => {
    if (!isThinking) return;

    const startedAt = Date.now();

    const timeout = setTimeout(() => {
      console.warn("[Tona] Thinking watchdog fired");
      setIsThinking(false);
      setLoading(false);
      isSendingRef.current = false;
      setProcessingLabel(null);

      removeThinkingPlaceholders();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Esse raciocínio demorou mais do que deveria. Eu parei o processamento para não travar sua conversa. Você pode tentar novamente ou continuar a partir do último contexto salvo.",
        data: {
          type: "recoverable_error"
        }
      }]);
    }, 60000);

    return () => clearTimeout(timeout);
  }, [isThinking]);

  function appendAssistantMessage(msg: any) {
    setMessages(prev => [...prev, { role: 'assistant', ...msg } as any]);
  }
  
  function appendAssistantPlaceholder(placeholder: any) {
      setMessages(prev => [...prev, { role: 'assistant', ...placeholder } as any]);
  }
  
  function buildConversationContext() {
      // Stub
      return {};
  }


  function isAllowedCompletedStageIntent(intent: string | null) {
  return [
    "start_reopen_discussion",
    "reopen_stage_point_discussion",
    "start_reopen_discussion_from_message",
    "select_reopen_point",
    "regenerate_stage_summary",
    "advance_stage",
    "generate_artifact",
    "attach_final_evidence"
  ].includes(intent || "");
}

async function handleStartReopenDiscussion() {
  setIsThinking(false);
  isSendingRef.current = false;
  removeThinkingPlaceholders();

  setReopenDiscussion({
    mode: "selecting_point",
    stageKey: activeStage,
    category: null,
    itemId: null,
    itemTitle: null,
    itemDescription: null,
    firstQuestionAsked: false
  });

  setMessages(prev => [...prev, {
    role: 'assistant',
    content: "Claro. A etapa já está consolidada, então vou reabrir apenas um ponto específico, sem desfazer o restante do resumo. Qual ponto você quer rediscutir?",
    data: {
      type: "reopen_point_selector",
      stage_key: activeStage
    },
    metadata: {
      intent: "start_reopen_discussion",
      stage_key: activeStage,
      stage_completed: true
    }
  }]);
}


async function markStageClosureAsNeedsUpdate(params: {
  productId: string,
  stageKey: string,
  reason: string,
  category: string,
  itemTitle: string
}) {
  try {
    const closureRef = doc(db, "mindflow_product_synthesis", params.productId, "items", `${params.stageKey}_stage_closure`);
    await updateDoc(closureRef, {
      needs_regeneration: true,
      last_reopen_reason: params.reason,
      last_reopened_item: {
        category: params.category,
        title: params.itemTitle,
        at: serverTimestamp()
      }
    });
  } catch (e) {
    console.warn("Failed to mark closure as dirty:", e);
  }
}

async function handleReopenDiscussionUserAnswer(message: any) {
  setMessages(prev => [...prev, {
    role: 'user',
    content: message,
    data: {
      intent: "reopen_discussion_answer",
      stage_key: activeStage,
      category: reopenDiscussion.category,
      item_title: reopenDiscussion.itemTitle
    }
  }]);

  await saveReopenDiscussionMemory({
    productId: product.id,
    stageKey: activeStage,
    category: reopenDiscussion.category,
    itemTitle: reopenDiscussion.itemTitle,
    content: message
  });

  const stop = evaluateConversationStopCriteria({
    mode: "reopen_discussion",
    stage: activeStageObject,
    thread: reopenDiscussion,
    last_user_message: message,
    collected_signals: [message],
    open_uncertainties: []
  });

  if (stop.shouldStopQuestions) {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: "Perfeito. Já tenho contexto suficiente para atualizar esse ponto no resumo da etapa. Quer que eu atualize o resumo inteligente agora ou prefere continuar aprofundando?",
      data: {
        type: "reopen_discussion_ready_to_close"
      }
    }]);
    return;
  }

  setMessages(prev => [...prev, {
    role: 'assistant',
    content: "Entendi. Falta só uma confirmação para eu não atualizar o resumo com ruído: isso muda o ponto consolidado ou apenas adiciona uma observação complementar?",
    data: {
      type: "reopen_point_followup",
      suggested_replies: [
        { label: "Muda o ponto", value: "Isso muda o ponto consolidado e deve alterar o resumo." },
        { label: "É complemento", value: "É apenas uma observação complementar para enriquecer o resumo." },
        { label: "Virou pendência", value: "Esse ponto deve ficar como pendência para validação." }
      ]
    }
  }]);
}

async function saveReopenDiscussionMemory(params: {
  productId: string,
  stageKey: string,
  category: string | null,
  itemTitle: string | null,
  content: string
}) {
  try {
    const memRef = collection(db, "products", params.productId, "memories");
    await addDoc(memRef, cleanFirestoreData({
      source: 'reopen_discussion',
      stage_key: params.stageKey,
      category: params.category,
      item_title: params.itemTitle,
      content: params.content,
      created_at: serverTimestamp(),
      user_id: user?.uid
    }));
  } catch (e) {
    console.error("Failed to save reopen memory:", e);
  }
}


  async function loadStageClosure() {
    if (!product.id || !activeStage) return null;
    
    // Safety check: skip if we already have it
    if (stageClosure && stageClosure.stage_id === activeStage) return stageClosure;

    const closureRef = doc(
      db,
      "mindflow_product_synthesis",
      product.id,
      "items",
      `${activeStage}_stage_closure`
    );

    const snap = await getDoc(closureRef);
    if (snap.exists()) {
      const data = {
        id: snap.id,
        ...snap.data()
      };
      setStageClosure(data as any);
      return data;
    }

    setStageClosure(null);
    return null;
  }

  async function generateStageClosureAutomatically() {
    if (!product.id || !stageCompleted || generatingClosure) return;

    setGeneratingClosure(true);
    setClosureError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Usuário não autenticado no cliente.");

      const response = await fetch("/api/admin/scheduler/run-stage-closure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          product_id: product.id,
          stage_key: activeStage,
          force: false,
          trigger: "automatic_stage_closure"
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.message || "Erro ao disparar atualização do resumo.");
      }

      // O Job roda em background ou foreground?
      // No server.ts, runStageClosureSummaryJobServer é awaited.
      // Então quando o request volta, o Firestore já deve estar atualizado.
      
      // Vamos tentar recarregar o closure do Firestore agora.
      const closureRef = doc(db, "mindflow_product_synthesis", product.id, "items", `${activeStage}_stage_closure`);
      const closureSnap = await getDoc(closureRef);
      
      if (closureSnap.exists()) {
        const data = closureSnap.data();
        setStageClosure(data as any);
        toast.success("Resumo inteligente atualizado pelo Agendador!");
      } else {
         // Se demorar um pouco, o usuário verá no próximo load ou via snapshot se tivermos um listener.
         // Mas como o Admin SDK usou await, o request do POST só termina quando salva.
         toast.success("Atualização concluída no servidor!");
      }
    } catch (error: any) {
      console.error("[StageClosure] API Trigger failed", error);
      setClosureError(error?.message || "Falha ao disparar Job de resumo.");
      toast.error("Erro ao solicitar atualização do resumo.");
    } finally {
      setGeneratingClosure(false);
    }
  }

  useEffect(() => {
    if (!product.id || !stageCompleted) return;

    let cancelled = false;

    async function run() {
      const existing = await loadStageClosure();

      if (cancelled) return;

      if (!existing) {
        await generateStageClosureAutomatically();
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [product.id, activeStage, stageCompleted]);

  useEffect(() => {
    if (product.id) {
      const q = query(
        getProductMemoriesCollection(db, product.id),
        where("status", "in", ["active", "needs_review"]),
        orderBy("updated_at", "desc"),
        limit(50)
      );
      const unsub = onSnapshot(q, (snap) => {
        setProductMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsub;
    }
  }, [product.id]);

  useEffect(() => {
    if (product.id) {
      const q = query(
        getProductSynthesisCollection(db, product.id),
        where("status", "==", "active"),
        orderBy("updated_at", "desc")
      );
      const unsub = onSnapshot(q, (snap) => {
        setSynthesisItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsub;
    }
  }, [product.id]);

  useEffect(() => {
    if (product?.id) {
      const q = query(
        collection(db, `products/${product.id}/fields`),
        where('stage_key', '==', activeStage),
        orderBy('updated_at', 'desc'),
        limit(50)
      );
      const unsub = onSnapshot(q, (snap) => {
        const fieldsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as StageField));
        setFields(fieldsData);
        
        // If stage is completed, check for closure
        if (activeStageObject?.progress >= 100 && !stageClosure) {
          getStageClosure(product.id, activeStage).then(setStageClosure);
        }
      });
      return unsub;
    }
  }, [product?.id, activeStage, db]);

  useEffect(() => {
    function handleFocusStageSummary(event: any) {
      if (event.detail?.productId !== product.id) return;
      if (event.detail?.stageKey !== activeStage) return;

      completedSummaryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    window.addEventListener("tona:focus-stage-summary" as any, handleFocusStageSummary);

    return () => {
      window.removeEventListener("tona:focus-stage-summary" as any, handleFocusStageSummary);
    };
  }, [product.id, activeStage]);

  async function handleGoToNextStage() {
    if (!product.id) return;
    const stageOrder = ["sense", "shape", "sketch", "scope", "ship", "sense_plus"];
    const currentIndex = stageOrder.indexOf(activeStage);
    const nextStage = stageOrder[currentIndex + 1];

    if (!nextStage) {
      toast("Você já está na última etapa!", { icon: '🏁' });
      return;
    }

    try {
      await updateDoc(doc(db, "products", product.id), {
        current_stage: nextStage,
        updated_at: serverTimestamp()
      });

      await setDoc(
        doc(db, "products", product.id, "stages", nextStage),
        {
          stage_key: nextStage,
          progress: 0,
          status: "active",
          started_at: serverTimestamp(),
          updated_at: serverTimestamp()
        },
        { merge: true }
      );

      toast.success(`Avançando para ${nextStage.toUpperCase()}`);
    } catch (e) {
      toast.error("Erro ao avançar etapa.");
    }
  }

  function buildReopenPointQuestions({ category, item }: { category: string, item: any }) {
    const title = item.title;
    const description = item.description || item.content || item.value || "";

    if (category === "decision") {
      return {
        message:
          `Perfeito. Vamos revisar a decisão "${title}" sem reabrir a etapa inteira.\n\n` +
          `Hoje ela está registrada assim: ${description || "sem descrição detalhada"}\n\n` +
          `Para entender se essa decisão continua válida, me responda uma destas frentes:\n\n` +
          `1. O que mudou desde que essa decisão foi consolidada?\n` +
          `2. Essa decisão ainda deve ser tratada como decisão ou voltou a ser hipótese?\n` +
          `3. Qual evidência sustenta manter, ajustar ou desfazer essa decisão?`,
        options: [
          {
            label: "O contexto mudou",
            value:
              `O contexto mudou para a decisão "${title}". Quero explicar o que mudou e como isso afeta a etapa.`
          },
          {
            label: "Virou hipótese",
            value:
              `A decisão "${title}" talvez precise voltar a ser hipótese. Quero revisar a força dessa decisão.`
          },
          {
            label: "Tenho evidência",
            value:
              `Tenho uma evidência nova sobre a decisão "${title}" e quero usá-la para atualizar o resumo.`
          }
        ]
      };
    }

    if (category === "hypothesis") {
      return {
        message:
          `Boa. Vamos testar melhor a hipótese "${title}".\n\n` +
          `Hoje ela está registrada assim: ${description || "sem descrição detalhada"}\n\n` +
          `Para ela ficar mais forte, preciso entender:\n\n` +
          `1. O que precisaria acontecer para confirmar ou derrubar essa hipótese?\n` +
          `2. Essa hipótese impacta cliente, negócio, tecnologia ou operação?\n` +
          `3. Qual seria o menor teste ou evidência para validá-la?`,
        options: [
          {
            label: "Definir evidência",
            value:
              `Quero definir qual evidência validaria ou derrubaria a hipótese "${title}".`
          },
          {
            label: "Mapear impacto",
            value:
              `Quero mapear o impacto da hipótese "${title}" em cliente, negócio, tecnologia ou operação.`
          },
          {
            label: "Criar teste",
            value:
              `Quero criar um teste simples para validar a hipótese "${title}".`
          }
        ]
      };
    }

    if (category === "fact") {
      return {
        message:
          `Vamos revisar a evidência "${title}".\n\n` +
          `Ela está registrada assim: ${description || "sem descrição detalhada"}\n\n` +
          `Para saber se ela é forte o suficiente para sustentar a etapa, preciso que você escolha uma direção:\n\n` +
          `1. Qual fonte comprova essa evidência?\n` +
          `2. Ela é recorrente ou aconteceu só uma vez?\n` +
          `3. Ela realmente sustenta o problema ou ainda é só percepção?`,
        options: [
          {
            label: "Informar fonte",
            value:
              `Quero informar a fonte da evidência "${title}".`
          },
          {
            label: "Avaliar recorrência",
            value:
              `Quero avaliar se a evidência "${title}" é recorrente ou pontual.`
          },
          {
            label: "Rebaixar para hipótese",
            value:
              `A evidência "${title}" talvez ainda seja percepção e deveria virar hipótese.`
          }
        ]
      };
    }

    if (category === "risk") {
      return {
        message:
          `Ótimo ponto para revisar. Vamos olhar para o risco "${title}".\n\n` +
          `Ele está descrito assim: ${description || "sem descrição detalhada"}\n\n` +
          `Para decidir como tratar esse risco, me ajude com uma dessas respostas:\n\n` +
          `1. Qual seria o impacto real se esse risco acontecer?\n` +
          `2. Já existe algum sinal de que ele está acontecendo?\n` +
          `3. Qual ação reduziria esse risco antes de avançarmos?`,
        options: [
          {
            label: "Descrever impacto",
            value:
              `Quero descrever o impacto real do risco "${title}".`
          },
          {
            label: "Tenho sinal atual",
            value:
              `Já existe sinal de que o risco "${title}" está acontecendo. Quero detalhar.`
          },
          {
            label: "Definir mitigação",
            value:
              `Quero definir uma ação de mitigação para o risco "${title}".`
          }
        ]
      };
    }

    return {
      message:
        `Vamos destravar a pendência "${title}".\n\n` +
        `Ela está registrada assim: ${description || "sem descrição detalhada"}\n\n` +
        `Para fechar ou encaminhar esse ponto, preciso entender:\n\n` +
        `1. O que falta decidir?\n` +
        `2. Quem precisa validar esse ponto?\n` +
        `3. Isso bloqueia o avanço ou pode seguir como acompanhamento?`,
      options: [
        {
          label: "Falta decisão",
          value:
            `Quero explicar o que falta decidir sobre a pendência "${title}".`
        },
        {
          label: "Precisa validação",
          value:
            `Quero indicar quem precisa validar a pendência "${title}".`
        },
        {
          label: "Não bloqueia avanço",
          value:
            `A pendência "${title}" não bloqueia o avanço e pode seguir como acompanhamento.`
        }
      ]
    };
  }

  async function handleSelectPointToReopen(category: ReopenDiscussionState['category'], item: any) {
    if (!product.id || !category) return;
    const pointTitle = item.title || item.label || "ponto da etapa";
    const pointDescription = item.content || item.value || item.description || "";
    const itemId = item.id || item.title || "point_id";

    // 1. Update State
    setReopenDiscussion({
       mode: "asking_questions",
       stageKey: activeStage,
       category,
       itemId: itemId,
       itemTitle: pointTitle,
       itemDescription: pointDescription,
       firstQuestionAsked: true
    });

    // 2. Mark closure as outdated in Firestore
    try {
      const closureRef = doc(db, "mindflow_product_synthesis", product.id, "items", `${activeStage}_stage_closure`);
      await updateDoc(closureRef, {
        needs_update: true,
        outdated_reason: "stage_point_reopened",
        outdated_at_ms: Date.now()
      });

      const stageRef = doc(db, "products", product.id, "stages", activeStage);
      await updateDoc(stageRef, {
        closure_status: "needs_update",
        closure_needs_update: true,
        closure_outdated_reason: "stage_point_reopened",
        closure_outdated_at_ms: Date.now()
      });
      
      setStageClosure(prev => prev ? { ...prev, needs_update: true } as any : null);
    } catch (e) {
      console.warn("Failed to mark closure as outdated:", e);
    }

    // 3. User message simulation
    setMessages(prev => [...prev, {
      role: 'user',
      content: `Quero rediscutir este ponto: ${pointTitle}.`,
      data: {
        intent: "reopen_stage_point_selected",
        stage_key: activeStage,
        category,
        item: { id: itemId, title: pointTitle, description: pointDescription }
      }
    }]);

    // 4. AIS deterministic questions
    const q = buildReopenPointQuestions({ category, item });
    
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: q.message,
        data: {
          type: "reopen_point_questions",
          question_strategy: {
            type: "multiple_choice",
            options: q.options.map((o, idx) => ({
              id: `reopen_${idx}`,
              letter: String.fromCharCode(65 + idx),
              label: o.label,
              value: o.value,
              short_label: o.label,
              description: ""
            })),
            allows_free_text: true
          },
          intent: "reopen_stage_point_discussion",
          discussion_status: "waiting_user_answer"
        }
      }]);
      
      setReopenDiscussion(prev => ({
        ...prev,
        mode: "waiting_user_answer"
      }));
    }, 500);

    // 5. Save interaction
    saveConversationMessage({
      product_id: product.id,
      user_id: user?.uid || '',
      user_email: user?.email || '',
      stage_key: activeStage,
      role: 'user',
      content: `Quero rediscutir este ponto: ${pointTitle}`,
      source: 'tona_chat_reopen'
    });
  }

  function handleReopenStageDiscussion() {
    return handleStartReopenDiscussion();
  }

  function humanizeOptionLabel(option: any) {
    if (option.short_label) return option.short_label;
    if (option.label) return option.label;
    if (option.letter) return `Opção ${option.letter}`;

    return option.id
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char: string) => char.toUpperCase());
  }

  function questionRequiresOptions(question: string) {
    const patterns = [
      "qual dessas",
      "qual destes",
      "qual dessas causas",
      "qual desses caminhos",
      "qual opção",
      "qual causa",
      "qual caminho",
      "qual impacto",
      "qual público",
      "qual prioridade",
      "o que pesa mais",
      "onde está a raiz",
      "o que parece mais forte",
      "o que dói mais",
      "o que trava mais"
    ];

    const normalized = question
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return patterns.some((pattern) => normalized.includes(
      pattern
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    ));
  }

  function buildOptionMessage(option: any) {
    const letter = option.letter || option.label || "";
    const title = option.title || option.text || option.name || option.label || "";
    const description = option.description || option.subtitle || option.details || "";
    const technicalValue = option.value || option.id || "";

    if (technicalValue === 'other' || technicalValue === 'outro_caminho') {
      return "Quero seguir por outro caminho. Me ajude a explorar uma alternativa diferente das opções sugeridas.";
    }

    const safeLetter = letter && String(letter).length === 1 ? `opção ${letter}` : "opção selecionada";

    if (title && description) {
      return `Quero seguir pela ${safeLetter}: ${title}.\n\n${description}`;
    }

    if (title) {
      return `Quero seguir pela ${safeLetter}: ${title}.`;
    }

    if (description) {
      return `Quero seguir pela ${safeLetter}.\n\n${description}`;
    }

    return String(technicalValue || "Quero seguir por esta opção.");
  }

  function normalizeClassification(value: any) {
    const raw = String(value || "").trim().toLowerCase();

    const map: Record<string, string> = {
      "decisão": "decision",
      "decision": "decision",
      "hipótese": "hypothesis",
      "hipotese": "hypothesis",
      "hypothesis": "hypothesis",
      "evidência": "evidence",
      "evidencia": "evidence",
      "evidence": "evidence",
      "fato": "fact",
      "fact": "fact",
      "risco": "risk",
      "risk": "risk",
      "pendência": "pending",
      "pendencia": "pending",
      "pending": "pending",
      "aprendizado": "learning",
      "learning": "learning"
    };

    return map[raw] || "fact";
  }

  function buildMemoryUpdatesFromStructuredOutput(aiData: any) {
    const structured = aiData || {};
    const updates: any[] = [];

    function pushMany(items: any[], classification: string, labelPrefix: string) {
      if (!Array.isArray(items)) return;

      items.forEach((item, index) => {
        const value =
          typeof item === "string"
            ? item
            : item?.value || item?.content || item?.text || item?.summary || "";

        if (!value) return;

        updates.push({
          field_key: item?.field_key || `${classification}_${index + 1}`,
          label: item?.label || item?.title || labelPrefix,
          value,
          classification: normalizeClassification(item?.classification || classification),
          confidence: Number(item?.confidence || item?.confidence_score || 0.75),
          source: "chat"
        });
      });
    }

    pushMany(structured.facts, "fact", "Fato");
    pushMany(structured.hypotheses, "hypothesis", "Hipótese");
    pushMany(structured.evidence, "evidence", "Evidência");
    pushMany(structured.decisions, "decision", "Decisão");
    pushMany(structured.risks, "risk", "Risco");
    pushMany(structured.pending_items, "pending", "Pendência");
    pushMany(structured.preferences, "fact", "Preferência");
    pushMany(structured.learnings, "learning", "Aprendizado");

    return updates;
  }

  function extractNextQuestion(text: string) {
    const content = String(text || "").trim();
    const matches = content.match(/[^.!?]*\?/g);

    if (!matches || matches.length === 0) return "";

    return matches[matches.length - 1].trim();
  }

  function didUserAnswerPendingQuestion(userMessage: string, pendingQuestion?: string) {
    if (!pendingQuestion) return false;

    const msg = String(userMessage || "").trim();
    if (msg.length < 2) return false;

    // Se usuário escolheu opção, respondeu.
    if (/^(a|b|c|d|e)$/i.test(msg)) return true;

    // Se contém texto com mais de 20 chars, tratar como resposta.
    if (msg.length > 20) return true;

    return false;
  }

  function buildConversationMemoryUpdate({
    previousMemory,
    userMessage,
    assistantReply,
    activeStage,
    product,
    aiData
  }: any) {
    const nextQuestion =
      aiData?.next_best_question ||
      extractNextQuestion(assistantReply) ||
      "";

    const userMessageClean = String(userMessage || "").trim();
    const assistantReplyClean = String(assistantReply || "").trim();

    const previousSummary = previousMemory?.conversation_summary || "";

    const shortUserSignal =
      userMessageClean.length > 220
        ? `${userMessageClean.slice(0, 220)}...`
        : userMessageClean;

    const shortAssistantSignal =
      assistantReplyClean.length > 260
        ? `${assistantReplyClean.slice(0, 260)}...`
        : assistantReplyClean;

    const newSummaryParts = [
      previousSummary,
      `Usuário respondeu: ${shortUserSignal}`,
      `Tona orientou: ${shortAssistantSignal}`
    ].filter(Boolean);

    const newSummary = newSummaryParts
      .join("\n")
      .slice(-2500);

    const unresolvedGapsFromAi =
      aiData?.gap_updates ||
      aiData?.pending_items ||
      aiData?.gaps ||
      previousMemory?.unresolved_gaps ||
      [];

    const answeredPreviousQuestion = didUserAnswerPendingQuestion(
      userMessageClean,
      previousMemory?.pending_question
    );

    return {
      product_id: product.id,
      active_stage_key: activeStage,
      conversation_summary: newSummary,
      pending_question: !answeredPreviousQuestion && previousMemory?.pending_question && !nextQuestion 
        ? previousMemory.pending_question 
        : nextQuestion,
      current_reasoning_thread:
        aiData?.current_reasoning_thread ||
        aiData?.reasoning_thread ||
        `Explorando a etapa ${activeStage} a partir da última resposta do usuário.`,
      next_best_action:
        aiData?.next_best_action ||
        (nextQuestion ? `Responder: ${nextQuestion}` : "Continuar a conversa com a Tona."),
      unresolved_gaps: Array.isArray(unresolvedGapsFromAi)
        ? unresolvedGapsFromAi.slice(0, 8)
        : [],
      last_user_message: userMessageClean,
      last_assistant_message: assistantReplyClean,
      last_interaction_at: serverTimestamp(),
      last_maturity_snapshot: {
        ...(previousMemory?.last_maturity_snapshot || {}),
        [activeStage]: aiData?.maturity_update?.new_score
          || previousMemory?.last_maturity_snapshot?.[activeStage]
          || 0
      }
    };
  }

  function buildFallbackOptionsFromMemory(stage: StageKey = 'sense') {
    // Stage-specific fallback options
    if (stage === 'sense') {
      return [
        {
          id: "method_gap",
          letter: "A",
          label: "Falta de método de fatiamento",
          short_label: "Falta de método",
          description: "A squad quer quebrar, mas não sabe como fatiar sem perder coerência de valor.",
          value: "Escolho a opção A: Falta de método de fatiamento. A squad quer quebrar, mas não sabe como fatiar sem perder coerência de valor."
        },
        {
          id: "scope_pressure",
          letter: "B",
          label: "Pressão por escopo fechado",
          short_label: "Pressão de escopo",
          description: "Existe uma percepção de que o valor só aparece se a iniciativa inteira for entregue.",
          value: "Escolho a opção B: Pressão por escopo fechado. Existe uma percepção de que o valor só aparece se a iniciativa inteira for entregue."
        },
        {
          id: "technical_coupling",
          letter: "C",
          label: "Acoplamento técnico/processual",
          short_label: "Acoplamento",
          description: "As partes dependem umas das outras e parecem impedir uma entrega menor funcional.",
          value: "Escolho a opção C: Acoplamento técnico/processual. As partes dependem umas das outras e parecem impedir uma entrega menor funcional."
        },
        {
          id: "granularity_issue",
          letter: "D",
          label: "Granularidade inconsistente",
          short_label: "Granularidade",
          description: "Os épicos acabam grandes ou pequenos demais para guiar bem priorização e execução.",
          value: "Escolho a opção D: Granularidade inconsistente. Os épicos acabam grandes ou pequenos demais para guiar bem priorização e execução."
        },
        {
          id: "other",
          letter: null,
          label: "Outro caminho",
          short_label: "Outro caminho",
          description: `Se você enxerga outro motivo, ${userName}, me conta o que foi.`,
          value: "Quero seguir por outro caminho."
        }
      ];
    }

    // Default fallback
    return [
      { id: "more_detail", letter: "A", label: "Preciso de mais detalhes", short_label: "Mais detalhes", description: "Vamos aprofundar no que já temos.", value: "Preciso de mais detalhes." },
      { id: "new_perspective", letter: "B", label: "Mudar perspectiva", short_label: "Nova visão", description: "Vamos olhar por outro ângulo.", value: "Vamos olhar por outro ângulo." },
      { id: "other", letter: null, label: "Outro caminho", short_label: "Outro", description: "Tenho outra ideia.", value: "Tenho outra ideia." }
    ];
  }

  function buildFallbackOptionsForCurrentContext(params: any) {
    if (params.stage === "sense" && params.productName.toLowerCase().includes("epic")) {
      return [
        {
          id: "pm_tradeoff",
          letter: "A",
          label: "Product Manager",
          short_label: "A. Product Manager",
          description: "Precisa defender trade-offs de valor, prazo e escopo com stakeholders.",
          value: "Escolho a opção A: o usuário principal é o Product Manager, que precisa defender trade-offs de valor, prazo e escopo com stakeholders."
        },
        {
          id: "leadership_prioritization",
          letter: "B",
          label: "Liderança / stakeholder",
          short_label: "B. Liderança",
          description: "Precisa comparar valor, risco e prazo para priorizar melhor.",
          value: "Escolho a opção B: o usuário principal é a liderança ou stakeholder, que precisa comparar valor, risco e prazo para priorizar melhor."
        },
        {
          id: "squad_alignment",
          letter: "C",
          label: "Squad de engenharia/design",
          short_label: "C. Squad",
          description: "Precisa entender o primeiro valor para construir com menos retrabalho.",
          value: "Escolho a opção C: o usuário principal é a squad de engenharia e design, que precisa entender o primeiro valor para construir com menos retrabalho."
        },
        {
          id: "product_ops_governance",
          letter: "D",
          label: "Product Ops / Agilidade",
          short_label: "D. Product Ops",
          description: "Precisa padronizar a qualidade dos épicos e apoiar governança.",
          value: "Escolho a opção D: o usuário principal é Product Ops ou Agilidade, que precisa padronizar a qualidade dos épicos e apoiar governança."
        },
        {
          id: "other",
          letter: null,
          label: "Outro caminho",
          short_label: "Outro",
          description: "Tenho outro usuário principal em mente.",
          value: "Quero seguir por outro caminho para definir o usuário principal."
        }
      ];
    }
    return buildFallbackOptionsFromMemory(params.stage);
  }


  useEffect(() => {
    if (product.id && user?.uid) {
      const initAssistant = async () => {
        setInitializing(true);
        try {
          const historyMessages = await getRecentConversationMessages({
            productId: product.id,
            userId: user.uid,
            stageKey: activeStage,
            limit: 30
          });

          if (historyMessages.length > 0) {
            setMessages(historyMessages
              .filter(m => {
                const content = m.content || "";
                return !content.includes("Tona orientou") && 
                       !content.includes("Usuário respondeu") && 
                       !content.includes("Mindflow") && 
                       !/Maturidade em \d+%/.test(content);
              })
              .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: removeStaleMaturityMentions(m.content),
                data: {
                  question_strategy: m.question_strategy,
                  memory_updates: m.memory_updates,
                  ...m.structured_data
                },
                isError: m.is_error
              })));
            
            // Default to collapsed history if it's long
            if (historyMessages.length > 4) {
              setShowFullHistory(false);
            } else {
              setShowFullHistory(true);
            }
            
            // Still load convo memory
            const memRef = doc(db, `products/${product.id}/conversation_memory`, user.uid);
            const memSnap = await getDoc(memRef);
            if (memSnap.exists()) {
              setConversationMemory({ id: memSnap.id, ...memSnap.data() } as ConversationMemory);
            }
            setInitializing(false);
            return;
          }

          // 1. Load Conversation Memory
          const memRef = doc(db, `products/${product.id}/conversation_memory`, user.uid);
          const memSnap = await getDoc(memRef);
          const convMem = memSnap.exists() ? ({ id: memSnap.id, ...memSnap.data() } as ConversationMemory) : null;
          setConversationMemory(convMem);

          // 2. Load Product Memory (Fields)
          const fieldsRef = collection(db, `products/${product.id}/fields`);
          const fieldsSnap = await getDocs(fieldsRef);
          const productMemory = fieldsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageField));

          // 3. Load stage data
          const stageData = stages.find(s => s.stage_key === activeStage);
          const stageMaturity = getStageProgress(stageData);

          if (isStageCompletedHelper(stageData)) {
            setMessages([]);
            setInitializing(false);
            return;
          }

          // 4. Determine opening mode
          const hasConversationMemory = !!convMem?.conversation_summary;
          const hasProductMemory = productMemory.length > 0;
          const hasMaturity = stageMaturity > 0;
          const hasPendingQuestion = !!convMem?.pending_question;

          const isResume = hasConversationMemory || hasProductMemory || hasMaturity || hasPendingQuestion;

          // 5. Backfill conversation memory if missing but product has memory
          if (!hasConversationMemory && isResume && !stageCompleted) {
            const initialSummary = `A etapa ${stages.find(s => s.stage_key === activeStage)?.name || activeStage.toUpperCase()} já possui sinais salvos na memória do produto. Use o resumo inteligente da etapa para revisar decisões, hipóteses, evidências e pendências.`;
            const backfillData = {
              product_id: product.id,
              user_id: user.uid,
              active_stage_key: activeStage,
              conversation_summary: initialSummary,
              status: 'active' as const,
              updated_at: serverTimestamp(),
              created_at: serverTimestamp()
            };
            await setDoc(memRef, backfillData);
            setConversationMemory(backfillData as any);
          }

          if (isResume && !stageCompleted) {
            // 5. Ensure conversation memory exists and is populated
            let currentConvMem = convMem;
            if (!hasConversationMemory) {
              const initialSummary = `A etapa ${stages.find(s => s.stage_key === activeStage)?.name || activeStage.toUpperCase()} já possui sinais salvos na memória do produto. Use o resumo inteligente da etapa para revisar decisões, hipóteses, evidências e pendências.`;
              const backfillData = {
                product_id: product.id,
                user_id: user.uid,
                active_stage_key: activeStage,
                conversation_summary: initialSummary,
                status: 'active' as const,
                updated_at: serverTimestamp(),
                created_at: serverTimestamp()
              };
              await setDoc(memRef, backfillData);
              currentConvMem = backfillData as any;
              setConversationMemory(currentConvMem);
            }

            // Build Resume Message with Situational Awareness
            const knownFacts = productMemory
              .filter(f => f.stage_key === activeStage && (f.classification === 'fact' || f.classification === 'decision'));
            const hypotheses = productMemory
              .filter(f => f.stage_key === activeStage && f.classification === 'hypothesis');
            const gaps = currentConvMem?.unresolved_gaps || [];

            // Primary Gap Identification
            const gapOrder = [
              { type: 'missing_evidence', label: 'evidência real', reason: 'ainda precisamos de um caso real para saber se essa dor é frequente e relevante.', keywords: ['evidência', 'exemplo', 'caso real', 'concreto'] },
              { type: 'missing_impact', label: 'impacto mensurável', reason: 'precisamos entender o tamanho do estrago quando isso acontece.', keywords: ['impacto', 'atraso', 'retrabalho', 'perda'] },
              { type: 'missing_frequency', label: 'frequência da dor', reason: 'ainda não sabemos se isso é um padrão ou um evento isolado.', keywords: ['frequência', 'constância', 'vezes'] },
              { type: 'unclear_persona', label: 'público-alvo específico', reason: 'parece que temos uma audiência, mas falta focar em quem sente a dor mais forte.', keywords: ['persona', 'público', 'quem'] },
              { type: 'unclear_root_cause', label: 'causa raiz', reason: 'entendemos o sintoma, mas falta chegar no motivo de fundo.', keywords: ['raiz', 'motivo', 'por que'] }
            ];

            let primaryGap = gapOrder.find(go => gaps.some(g => go.keywords.some(k => g.toLowerCase().includes(k)))) || gapOrder[0];
            
            // Situational Question Generator
            const situationalQuestions: Record<string, string> = {
              'missing_evidence': `Me conta um caso recente: qual iniciativa ficou difícil de fatiar em épicos e o que travou na prática?`,
              'missing_impact': `Quando essa dificuldade aparece, o impacto pesa mais em atraso, retrabalho, desalinhamento ou baixa clareza para priorização?`,
              'missing_frequency': `Isso acontece em toda iniciativa grande ou só em alguns casos? Quantas vezes você viu esse problema nas últimas iniciativas?`,
              'unclear_persona': `Quando falamos de Product Managers, qual perfil sente mais essa dor: PM júnior, PM sênior, PM de plataforma, PM de produto digital ou outro?`,
              'unclear_root_cause': `A raiz parece estar na granularidade, mas quero afinar: isso nasce mais de falta de critério, pressão de stakeholder, incerteza técnica ou ausência de exemplos bons?`
            };

            const nextSituationalQuestion = currentConvMem?.pending_question || situationalQuestions[primaryGap.type] || `Qual exemplo real podemos usar para validar essa hipótese agora?`;

            // Reasoning Synthesis
            let content = `${userName}, retomando de onde paramos no ${product.name}.\n\n`;
            content += `Estamos em **${stages.find(s => s.stage_key === activeStage)?.name || activeStage.toUpperCase()}** com **${stageMaturity}%** de maturidade.\n\n`;
            
            if (knownFacts.length > 0 || hypotheses.length > 0) {
              const mainHypothesis = hypotheses[0]?.value || knownFacts[0]?.value;
              const secondaryItems = [...knownFacts, ...hypotheses].slice(1, 3).map(i => i.value);
              
              content += `Até aqui, a hipótese principal é que **${mainHypothesis}**. `;
              if (secondaryItems.length > 0) {
                content += `Também já mapeamos: ${secondaryItems.join(', ')}.`;
              }
              content += `\n\n`;
            }

            content += `A próxima lacuna é **${primaryGap.label}**: ${primaryGap.reason}\n\n`;

            // Check if question requires options
            const needsOptions = questionRequiresOptions(nextSituationalQuestion);
            let resumeData = null;

            if (needsOptions) {
              const fallbackOptions = buildFallbackOptionsFromMemory(activeStage);
              resumeData = {
                question_strategy: {
                  type: "multiple_choice",
                  reason: "A pergunta pede escolha entre causas-raiz prováveis identificadas na memória do produto.",
                  options: fallbackOptions,
                  allows_free_text: true,
                  free_text_trigger_option_id: "other"
                }
              };

              content += `Para continuar, precisamos escolher a causa raiz principal que o ${product.name} deve atacar primeiro.\n\nPelo que já apareceu até aqui, vejo algumas hipóteses prováveis:\n\n`;
              fallbackOptions.filter(o => o.letter).forEach(o => {
                content += `${o.letter}) ${o.label}  \n`;
              });
              content += `\n**${nextSituationalQuestion}**\n\n`;
              content += `Você pode escolher uma, combinar mais de uma ou seguir por outro caminho.`;
            } else {
              content += `**${nextSituationalQuestion}**`;
            }

            // Save the situational question if it was empty, to ensure "Continuar daqui" and consistency
            if (!currentConvMem?.pending_question) {
              await setDoc(memRef, { 
                pending_question: nextSituationalQuestion,
                next_best_action: `Responder sobre ${primaryGap.label}.`,
                current_reasoning_thread: `Validando ${primaryGap.label} para amadurecer a etapa.`
              }, { merge: true });
            }

            setMessages([{ role: 'assistant', content, data: resumeData }]);
          } else {
            // New Product Welcome
            setMessages([
              { 
                role: 'assistant', 
                content: `Olá! Sou a Tona, sua copilota de produto. Minha missão é ajudar você a trazer à tona o que sua ideia ainda precisa para ficar mais clara, forte e acionável.\n\nEstamos na etapa **${activeStage.toUpperCase()}**. O que você tem em mente agora?` 
              }
            ]);
          }
        } catch (e) {
          console.error("Error initializing assistant:", e);
        } finally {
          setInitializing(false);
        }
      };
      initAssistant();
    }
  }, [product.id, user?.uid, activeStage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function updateStructuredMemory(update: any) {
    if (!product.id) return;
    const effectiveStage = update.stage_focus || activeStage;

    // 1. Update Fields (Legacy UI Memory)
    const fieldsPath = `products/${product.id}/fields`;
    for (const mem of update.memory_updates || []) {
      try {
        const q = query(
          collection(db, fieldsPath), 
          where('field_key', '==', mem.field_key), 
          where('stage_key', '==', effectiveStage)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          await updateDoc(doc(db, fieldsPath, snap.docs[0].id), {
            value: mem.value,
            classification: mem.classification,
            confidence: mem.confidence,
            updated_at: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, fieldsPath), cleanFirestoreData({
            product_id: product.id,
            stage_key: effectiveStage,
            field_key: mem.field_key,
            label: mem.label,
            value: mem.value,
            classification: mem.classification,
            confidence: mem.confidence,
            source: 'chat',
            quality_status: 'draft',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
          }));
        }

        // 1.1 Persist in Mindflow Cognitive Depth (mindflow_product_memories)
        await addDoc(
          getProductMemoriesCollection(db, product.id),
          cleanFirestoreData({
            product_id: product.id,
            product_name: product.name || null,
            stage_id: effectiveStage,
            stage_name: stages.find(s => s.stage_key === effectiveStage)?.name || effectiveStage,
            author_user_id: user?.uid || null,
            author_email: user?.email || null,
            author_name: profile?.display_name || user?.displayName || user?.email || null,
            author_role: workspaceAccess?.role || permissions?.role || "unknown",
            memory_type: normalizeClassification(mem.classification),
            title: mem.label || mem.field_key,
            content: mem.value,
            normalized_content: String(mem.value || "").toLowerCase(),
            confidence: Number(mem.confidence || 0.75),
            evidence_level: normalizeClassification(mem.classification) === "evidence" ? "explicit" : "inferred",
            source_type: "conversation",
            source_refs: [{ type: "chat", id: "current_turn", label: "Conversa com a Tona" }],
            visibility: "product_collaborators",
            status: mem.requires_confirmation ? "needs_review" : "active",
            tags: [effectiveStage, normalizeClassification(mem.classification)],
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
          })
        );
      } catch (e) {
        console.error("Error updating field/cognitive memory:", e);
      }
    }

    if (update.memory_updates?.length > 0 && effectiveStage) {
      await touchStage(product.id, effectiveStage, 'field').catch(e => console.warn("touchStage field failed", e));
    }

    // 2. Update Stage Maturity
    if (update.maturity_update) {
      const stageRef = doc(db, `products/${product.id}/stages`, update.maturity_update.stage_key);
      try {
        const rawScore = update.maturity_update.new_score;
        const newStageProgress = normalizeProgress(rawScore);
        
        const stageUpdatePayload: any = {
          progress: newStageProgress,
          updated_at: serverTimestamp()
        };

        if (newStageProgress >= 100) {
          stageUpdatePayload.status = "completed";
          stageUpdatePayload.is_completed = true;
          stageUpdatePayload.completed_at = serverTimestamp();

          // Trigger AI stage closure generation early or ensure it happens
          try {
            const messagesForClosure = messages.map(m => ({ role: m.role, content: m.content }));
            const closure = await generateStageClosureWithAI({
              product,
              stage: activeStageObject,
              fields,
              productMemories,
              conversationMemories: conversationMemory ? [conversationMemory] : [],
              stageMessages: messagesForClosure
            });

            await saveStageClosure({
              productId: product.id,
              stageKey: activeStage,
              closure
            });
            setStageClosure(closure as any);
          } catch (e) {
             console.warn("[StageClosure] Auto-generation failed", e);
          }
        }

        await updateDoc(stageRef, stageUpdatePayload);

        // Sync product progress (Using Centralized Logic)
        const updatedStages = stages.map(s => 
          s.stage_key === update.maturity_update.stage_key 
            ? { ...s, progress: newStageProgress } 
            : s
        );
        
        syncProductEvolutionCache(product.id)
          .catch(e => console.error("Error updating evolution cache:", e));

      } catch (e) {
        console.error("Error updating stage maturity:", e);
      }
    }

    // 3. Update Conversation Memory (Resumo e Estado Contextual)
    if (update.conversation_memory_update && user?.uid) {
      const memRef = doc(db, `products/${product.id}/conversation_memory`, user.uid);
      try {
        // Sanitize sumaries before saving
        if (update.conversation_memory_update.conversation_summary) {
          update.conversation_memory_update.conversation_summary = cleanConversationSummaryForDisplay(
            removeStaleMaturityMentions(update.conversation_memory_update.conversation_summary)
          );
        }

        const dataToSave = {
          ...update.conversation_memory_update,
          status: 'active',
          product_id: product.id,
          user_id: user.uid,
          updated_at: serverTimestamp()
        };
        
        // Remove undefined fields
        Object.keys(dataToSave).forEach(key => (dataToSave as any)[key] === undefined && delete (dataToSave as any)[key]);

        await setDoc(memRef, dataToSave, { merge: true });
        
        // Update local state
        setConversationMemory(prev => ({ ...prev, ...dataToSave } as ConversationMemory));

        // 3.1 Update Synthesis Consolidation (mindflow_product_synthesis)
        if (update.conversation_memory_update.conversation_summary) {
          await setDoc(
            doc(db, "mindflow_product_synthesis", product.id, "items", `${effectiveStage}_current_understanding`),
            cleanFirestoreData({
              product_id: product.id,
              product_name: product.name || null,
              stage_id: effectiveStage,
              synthesis_type: "current_understanding",
              title: "Entendimento atual",
              content: update.conversation_memory_update.conversation_summary,
              source_user_ids: [user?.uid].filter(Boolean),
              confidence: 0.8,
              status: "active",
              last_generated_by: "tona",
              updated_at: serverTimestamp(),
              created_at: serverTimestamp()
            }),
            { merge: true }
          );
        }

        if (update.conversation_memory_update.next_best_action) {
          await setDoc(
            doc(db, "mindflow_product_synthesis", product.id, "items", `${effectiveStage}_next_best_step`),
            cleanFirestoreData({
              product_id: product.id,
              product_name: product.name || null,
              stage_id: effectiveStage,
              synthesis_type: "next_best_step",
              title: "Próximo melhor passo",
              content: update.conversation_memory_update.next_best_action,
              confidence: 0.75,
              status: "active",
              last_generated_by: "tona",
              updated_at: serverTimestamp(),
              created_at: serverTimestamp()
            }),
            { merge: true }
          );
        }
      } catch (e) {
        console.error("Error updating conversation memory/synthesis:", e);
      }
    }

    // 4. Register Interaction Event (mindflow_interactions)
    try {
      await addDoc(
        getProductInteractionsCollection(db, product.id),
        cleanFirestoreData({
          product_id: product.id,
          product_name: product.name || null,
          user_id: user?.uid || null,
          user_email: user?.email || null,
          user_name: profile?.display_name || user?.displayName || null,
          user_role: workspaceAccess?.role || permissions?.role || "unknown",
          stage_id: effectiveStage,
          stage_name: stages.find(s => s.stage_key === effectiveStage)?.name || effectiveStage,
          event_type: "memory_generated",
          input_text: update.conversation_memory_update?.last_user_message || null,
          output_text: update.assistant_message || null,
          generated_memory_count: update.memory_updates?.length || 0,
          maturity_update: update.maturity_update || null,
          metadata: { source: "AIAssistantPanel.updateStructuredMemory" },
          created_at: serverTimestamp()
        })
      );

      // Update basic product counters
      if ((update.memory_updates?.length || 0) > 0) {
        await updateDoc(doc(db, "products", product.id), {
          memory_count: increment(update.memory_updates.length),
          last_memory_update_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });

        if (effectiveStage) {
          await touchStage(product.id, effectiveStage, 'memory');
        }
      }
    } catch (e) {
      console.warn("[AIAssistantPanel] Failed to log interaction event", e);
    }
  }

  async function handleFileAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const taskId = `upload_${Date.now()}`;
    
    try {
      setLoading(true); // Keep UI busy
      await uploadProductDocument({
        product,
        file,
        stageKey: activeStage,
        source: "conversation_attachment",
        autoProcess: true,
        autoAddToMemory: true,
        currentUser: user,
        adminContext: adminCtx || undefined,
        onProgress: (p) => {
          setUploadTasks(prev => ({
            ...prev,
            [taskId]: p
          }));
          
          // When processed, add a virtual message or update state
          if (p.phase === 'processed') {
             setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Recebi e processei o documento **${file.name}**. Analisei o conteúdo e já extraí os pontos principais para a inteligência do produto.`,
                data: {
                  type: 'document_processed',
                  fileName: file.name,
                  documentId: p.documentId
                }
             }]);
             toast.success(`Documento ${file.name} processado!`);
          }
          
          if (p.phase === 'failed') {
             setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Houve um erro ao processar o documento **${file.name}**. ${p.message}`,
                isError: true
             }]);
             toast.error(`Falha no documento ${file.name}`);
          }
        }
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Erro no upload");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleMessageInCompletedStage(message: string) {
    appendAssistantMessage({
      role: 'assistant',
      content: "A etapa já está concluída. Por favor, use as ações disponíveis para rediscutir pontos ou avançar.",
      data: { type: "info" }
    });
  }

  async function handleSend(customMessage?: string, metadata?: any) {
    const userMsg = customMessage || input.trim();
    
    if (
      reopenDiscussion?.mode === "waiting_user_answer" &&
      reopenDiscussion?.stageKey === activeStage
    ) {
      await handleReopenDiscussionUserAnswer(userMsg);
      return;
    }

    const intent = metadata?.intent || null;
    if (stageCompleted && !isAllowedCompletedStageIntent(intent)) {
      handleMessageInCompletedStage(userMsg);
      return;
    }

    if (isSendingRef.current || isThinking || !userMsg) return;

    if (!customMessage) setInput('');
    setIsOtherSelected(false);

    // Clear reopen selection mode if active and user just typed something
    if (reopenDiscussion.mode === 'selecting_point' && !metadata?.intent) {
      setReopenDiscussion(prev => ({ ...prev, mode: "idle" }));
    }
    
    // 1. Salvar mensagem do usuário localmente primeiro
    setMessages(prev => [...prev, { role: 'user', content: userMsg, data: metadata }]);
    
    isSendingRef.current = true;
    setIsThinking(true);
    setLoading(true);
    setProcessingLabel("Tona está organizando o raciocínio...");
    setLastError(null);

    // Salvar mensagem do usuário no histórico persistente
    saveConversationMessage({
      product_id: product.id,
      user_id: user?.uid || '',
      user_email: user?.email || '',
      stage_key: activeStage,
      role: 'user',
      content: userMsg,
      metadata: metadata || null,
      source: 'tona_chat'
    });

    // Record interaction
    recordProductInteraction({
      productId: product.id,
      user,
      profile,
      role: adminCtx?.isOwner ? 'owner' : adminCtx?.isAdmin ? 'admin' : 'editor',
      section: 'chat',
      event: 'message_created'
    });

    if (activeStage) {
      touchStage(product.id, activeStage, 'conversation').catch(e => console.warn("[AIAssistantPanel] touchStage failed", e));
    }

    try {
      // 2. Montar contexto e chamar MindFlow
      const result: MindflowTurnResult = await withTimeout(
        runTonaConversationTurn({
          userId: user?.uid || '',
          userIdentifier: profile?.display_name || user?.email || undefined,
          userMessage: userMsg,
          userEmail: user?.email || undefined,
          productId: product.id,
          stageId: activeStage,
          agentId: 'tona_orchestrator',
          rawPayload: { 
            conversation_count: messages.length,
            system_role: adminCtx?.isOwner ? 'OWNER' : adminCtx?.isAdmin ? 'ADMIN' : 'USER',
            product_role: workspaceAccess?.role || permissions?.role || 'viewer',
            permissions,
            selected_option: metadata?.selected_option || null,
            intent: metadata?.intent || (reopenDiscussion.mode === 'waiting_user_answer' ? 'reopen_stage_point_discussion' : null),
            reopen_context: (metadata?.intent === 'reopen_stage_point_discussion' || reopenDiscussion.mode === 'waiting_user_answer') ? {
              category: metadata?.point_category || reopenDiscussion.category,
              title: metadata?.point_title || reopenDiscussion.itemTitle,
              description: metadata?.point_description || reopenDiscussion.itemDescription,
              current_item: metadata?.current_item || { id: reopenDiscussion.itemId }
            } : null
          }
        }),
        CONVERSATION_TIMEOUT_MS,
        "TONA_CONVERSATION"
      );

      if (!result) {
        throw new Error("TONA_EMPTY_RESPONSE");
      }

      // Salvar histórico bruto no Firestore para auditoria/rastreabilidade
      try {
        await addDoc(collection(db, "products", product.id, "messages"), cleanFirestoreData({
          role: "user",
          content: userMsg,
          user_id: user?.uid || null,
          user_email: user?.email || null,
          stage_key: activeStage,
          created_at: serverTimestamp(),
          metadata: metadata || null
        }));
      } catch (msgErr) {
        console.warn("[AIAssistantPanel] Failed to save user message to history", msgErr);
      }

      if (result.ok) {
        // Sucesso: Mapear para estrutura local se necessário
        const aiData: any = {
          assistant_message: result.reply,
          memory_updates: result.memoryUpdates?.map((r: any) => ({
             field_key: r.field_key || r.classification || 'learning',
             label: r.label || r.classification || 'Aprendizado',
             value: r.content,
             classification: normalizeClassification(r.classification || 'fact'),
             confidence: r.confidence_score || r.confidence || 0.7,
             source: 'chat'
          })) || [],
          next_best_question: extractNextQuestion(result.reply),
          ...result.stageUpdates,
          question_strategy: result.questionStrategy || (result.stageUpdates as any)?.question_strategy,
          suggested_quick_actions: result.suggestedQuickActions || []
        };

        // Enriquecer memory_updates a partir do structured_output (facts, hypotheses, etc)
        const structuredMemoryUpdates = buildMemoryUpdatesFromStructuredOutput(aiData);
        const mergedMemoryUpdates = [...aiData.memory_updates, ...structuredMemoryUpdates];
        
        // Deduplicar por field_key + value para evitar ruído
        const seenMemory = new Set();
        aiData.memory_updates = mergedMemoryUpdates.filter((item: any) => {
          const key = `${item.field_key}:${item.value}`;
          if (seenMemory.has(key)) return false;
          seenMemory.add(key);
          return true;
        });

        // Gerar atualização de memória conversacional segura e persistente
        const safeConversationMemoryUpdate = buildConversationMemoryUpdate({
          previousMemory: conversationMemory,
          userMessage: userMsg,
          assistantReply: result.reply,
          activeStage,
          product,
          aiData
        });

        aiData.conversation_memory_update = {
          ...(aiData.conversation_memory_update || {}),
          ...safeConversationMemoryUpdate
        };

        try {
          if (
            aiData.memory_updates?.length ||
            aiData.maturity_update ||
            aiData.conversation_memory_update
          ) {
            await updateStructuredMemory(aiData);
          }
        } catch (persistError) {
          console.warn("[AIAssistantPanel] Failed to persist structured update", persistError);
        }

        // Salvar resposta da Tona no histórico bruto
        try {
          await addDoc(collection(db, "products", product.id, "messages"), cleanFirestoreData({
            role: "assistant",
            content: result.reply,
            user_id: user?.uid || null,
            user_email: user?.email || null,
            stage_key: activeStage,
            created_at: serverTimestamp(),
            metadata: {
              ok: result.ok,
              debug: result.debug || null
            }
          }));
        } catch (msgErr) {
          console.warn("[AIAssistantPanel] Failed to save assistant message to history", msgErr);
        }

        const replyNeedsOptions = questionRequiresOptions(result.reply);
        const hasOptions = aiData.question_strategy?.options?.length > 0;
        
        if (replyNeedsOptions && !hasOptions) {
          aiData.question_strategy = {
            type: "multiple_choice",
            reason: "Fallback automático para evitar pergunta aberta.",
            options: buildFallbackOptionsForCurrentContext({
              stage: activeStage,
              productName: product.name,
              conversationMemory: conversationMemory
            }),
            allows_free_text: true,
            free_text_trigger_option_id: "other"
          };
        }

        // Salvar mensagem do assistente no histórico
        saveConversationMessage({
          product_id: product.id,
          user_id: user?.uid || '',
          user_email: user?.email || '',
          stage_key: activeStage,
          role: 'assistant',
          content: result.reply,
          structured_data: result.stageUpdates,
          question_strategy: aiData.question_strategy,
          memory_updates: result.memoryUpdates,
          source: 'tona_chat'
        });

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.reply,
          data: aiData
        }]);
      } else {
        // Erro recuperável
        setLastError(result);

        saveConversationMessage({
          product_id: product.id,
          user_id: user?.uid || '',
          user_email: user?.email || '',
          stage_key: activeStage,
          role: 'assistant',
          content: result.reply,
          is_error: true,
          structured_data: result.debug,
          source: 'tona_chat'
        });

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.reply,
          isError: true,
          data: result.debug
        }]);
      }
    } catch (error: any) {
      console.error("[Tona Conversation] failed", error);
      
      const normalized = normalizeConversationError(error);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: normalized.userMessage,
        data: {
          type: "recoverable_error",
          error_code: normalized.code,
          original_message: userMsg
        }
      }]);
      
    } finally {
      isSendingRef.current = false;
      setIsThinking(false);
      setLoading(false);
      setProcessingLabel(null);
      removeThinkingPlaceholders();
    }
  }

  async function handleResume() {
    if (stageCompleted) {
      setInput("Quero revisar um ponto específico da etapa concluída antes de avançar.");
      textareaRef.current?.focus();
      return;
    }
    await handleSend("Retome a conversa a partir do último estado salvo do produto e da etapa ativa.");
  }

  function handleDiscussClosurePoint(point: any) {
    const category = normalizeClassification(point.section || point.classification || point.memory_type);
    handleSelectPointToReopen(category as any, point);
  }

  useImperativeHandle(ref, () => ({
    resume: handleResume
  }));

  const currentMessageData = messages[messages.length - 1]?.data;
  const isResumeMode = messages.length === 1 && messages[0].content.includes('retomando de onde paramos');

  const completionQuickActions = [
    "Avançar para próxima etapa",
    "Rediscutir um ponto",
    "Gerar relatório da etapa",
    "Anexar evidência final"
  ];

  const defaultQuickActions = isStageCompleted
    ? completionQuickActions
    : isResumeMode ? [
        "Trazer caso real",
        "Estimar impacto",
        "Explicar frequência",
        "Confirmar público",
        "Revisar causa raiz",
        "Anexar evidência"
      ] : [
        "Me ajuda a pensar",
        "Qual é o próximo passo?",
        "Quero anexar um documento",
        "Isso é uma hipótese"
      ];

  const quickActions = currentMessageData?.suggested_quick_actions || defaultQuickActions;

  const resumeOptions = (isResumeMode && messages[0]?.data?.question_strategy?.options) || [];
  const currentOptions = currentMessageData?.question_strategy?.options || [];
  const activeOptions = currentOptions.length > 0 ? currentOptions : resumeOptions;

  const hasActiveOptions = activeOptions.length > 0;
  const displayQuickActions = hasActiveOptions
    ? ["Me ajuda a pensar", "Outro caminho"]
    : quickActions;

  const finalQuickActions = stageCompleted 
    ? (reopenDiscussion.mode === 'waiting_user_answer' 
        ? ["Regenerar resumo inteligente", "Manter como pendência", "Anexar evidência"]
        : ["Avançar para próxima etapa", "Rediscutir um ponto", "Regenerar resumo inteligente"])
    : displayQuickActions;

  if (initializing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-8">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Brain className="w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Tona está recuperando o contexto do produto...</p>
      </div>
    );
  }

  const currentPendingQuestion = currentMessageData?.question_strategy?.options 
    ? currentMessageData.assistant_message
    : (isResumeMode ? messages[0]?.content : conversationMemory?.pending_question);

  const hasOptions = !!currentMessageData?.question_strategy?.options || (isResumeMode && messages[0]?.data?.question_strategy?.options);

  const inputPlaceholder = isOtherSelected 
    ? `Me conta o outro motivo que ${activeStage === 'sense' ? 'travou o fatiamento' : 'está impedindo o avanço'}...`
    : isStageCompleted
      ? "Etapa finalizada. Você pode rediscutir pontos ou avançar..."
      : hasOptions
        ? "Escolha uma opção, combine letras ou conte do seu jeito..."
        : isResumeMode && currentPendingQuestion
          ? "Responda à pergunta da Tona ou conte um caso real..." 
          : "Falar com a Tona...";

  return (
    <div className="flex flex-col h-full bg-white font-sans max-w-5xl mx-auto w-full">
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth no-scrollbar"
      >
         <header className="py-12 border-b border-slate-50 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-200">
               <Bot className="text-white w-8 h-8" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Tona</h2>
               <p className="text-sm font-medium text-slate-400 max-w-sm">
                  Conte sua ideia, problema ou oportunidade. A Tona vai trazer à tona o que importa, organizar a memória do produto e mostrar o que falta para amadurecer cada etapa.
               </p>
               {conversationMemory?.updated_at && (
                 <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2">
                   Última conversa: {new Date(conversationMemory.updated_at.seconds * 1000).toLocaleString()}
                 </p>
               )}
            </div>
         </header>

         {conversationMemory?.pending_question && !isStageCompleted && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-8 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl space-y-4"
            >
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                        <MessageSquare className="w-4 h-4" />
                     </div>
                     <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">Onde paramos</span>
                  </div>
                  <div className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-indigo-600 border border-indigo-100">
                     Maturidade: {conversationMemory.last_maturity_snapshot?.[activeStage] || stages.find(s => s.stage_key === activeStage)?.progress || 0}%
                  </div>
               </div>
               
               <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tema Atual</span>
                     <p className="text-sm font-bold text-indigo-900">{conversationMemory.current_reasoning_thread || 'Explorando o produto'}</p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Próximo Passo</span>
                     <p className="text-xs font-medium text-indigo-700 leading-relaxed">
                        {conversationMemory.next_best_action || 'Responder à última pergunta da Tona.'}
                     </p>
                  </div>

                  {conversationMemory.unresolved_gaps && conversationMemory.unresolved_gaps.length > 0 && (
                     <div className="flex flex-wrap gap-1.5 mt-2">
                        {conversationMemory.unresolved_gaps.slice(0, 3).map((gap, idx) => (
                           <div key={idx} className="px-2 py-0.5 bg-indigo-100 text-[9px] font-bold text-indigo-600 rounded-lg uppercase tracking-tight">
                              Lacuna: {gap}
                           </div>
                        ))}
                     </div>
                  )}
               </div>

               <button 
                 onClick={handleResume}
                 className="w-full py-3 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
               >
                  <ArrowRight className="w-3 h-3" />
                  Continuar daqui
               </button>
            </motion.div>
         )}

         <div className="space-y-8 pb-12">
            {stageCompleted && (
              <div className="mx-8">
                {!stageClosure && generatingClosure && (
                  <div className="rounded-[32px] border border-indigo-100 bg-indigo-50 p-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <h3 className="text-xl font-black text-slate-950">
                      Tona está gerando o resumo inteligente...
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Estou lendo a memória da etapa, separando decisões, hipóteses, evidências e pendências.
                    </p>
                  </div>
                )}

                {!stageClosure && !generatingClosure && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center">
                    <h3 className="text-xl font-black text-slate-950">
                      Etapa finalizada!
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      O resumo inteligente ainda não foi consolidado.
                    </p>
                    <button
                      type="button"
                      onClick={generateStageClosureAutomatically}
                      className="mt-5 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
                    >
                      Gerar resumo inteligente
                    </button>
                  </div>
                )}

                {stageClosure && (
                  <StageClosureCard
                    closure={stageClosure}
                    progress={activeStageProgress}
                    onDiscussPoint={handleDiscussClosurePoint}
                    onGoToNextStage={handleGoToNextStage}
                    onRegenerate={generateStageClosureAutomatically}
                  />
                )}
              </div>
            )}

            {!stageCompleted && messages.length > 4 && !showFullHistory && (
              <div className="mx-8 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-4 mb-10 overflow-hidden relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <Brain className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Resumo da Conversa</span>
                  </div>
                  <button 
                    onClick={() => setShowFullHistory(true)}
                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                  >
                    Ver detalhes ({messages.length - 2} msg)
                  </button>
                </div>
                {conversationMemory?.conversation_summary ? (
                  <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                    "{conversationMemory.conversation_summary}"
                  </p>
                ) : (
                  <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
                    Conversamos sobre {product.name} na etapa {activeStage.toUpperCase()}.
                  </p>
                )}
                <div className="h-px bg-slate-200 w-full" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atalho Rápido</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <p className="text-xs font-bold text-indigo-900">{conversationMemory?.current_reasoning_thread || 'Progresso da etapa'}</p>
                  </div>
                </div>
              </div>
            )}

                  {messages.map((m, idx) => {
                    const isLast = idx === messages.length - 1;
                    const isUser = m.role === 'user';
                    
                    // Hide old messages if history is collapsed (except for reopened selector/questions)
                    const isOldMessage = messages.length > 4 && idx < messages.length - 2;
                    const isReopenMeta = m.data?.type?.startsWith('reopen_');
                    
                    if (isOldMessage && !showFullHistory && !isReopenMeta) return null;

                    // Render point selector if metadata says so
                    if (m.data?.type === 'reopen_point_selector' && stageClosure) {
                      return (
                        <div key={idx} className="flex flex-col gap-4 w-full">
                          <div className="flex gap-3 max-w-[85%] self-start animate-in slide-in-from-left">
                             <div className="mt-1 h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 shadow-sm">
                                <Bot size={18} />
                             </div>
                             <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm text-sm font-semibold text-slate-700 leading-relaxed italic">
                                {m.content}
                             </div>
                          </div>
                          <StageReopenDiscussionCard 
                            closure={stageClosure}
                            onSelectPoint={handleSelectPointToReopen}
                          />
                        </div>
                      );
                    }
            
            if (isTechnicalResumeMessage(m)) return null;

            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx} 
                className={cn(
                  "flex gap-4",
                  m.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                  <div className={cn(
                    "w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center border shadow-sm transition-all animate-in zoom-in-50 duration-500",
                    m.role === 'user' ? "bg-white border-slate-200 text-slate-400" : "bg-slate-900 border-slate-800 text-white shadow-slate-200"
                  )}>
                     {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col gap-2 max-w-[80%]",
                    m.role === 'user' ? "items-end" : "items-start"
                  )}>
                     <div className={cn(
                        "p-6 rounded-[2rem] text-[15px] leading-relaxed shadow-sm transition-all",
                        m.role === 'user' 
                          ? "bg-indigo-600 text-white rounded-tr-none" 
                          : m.isError 
                            ? "bg-rose-50 text-rose-800 rounded-tl-none border border-rose-100"
                            : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100"
                     )}>
                        <div className={cn(
                           "markdown-body prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-strong:text-inherit",
                           m.role === 'user' ? "text-white" : m.isError ? "text-rose-900" : "text-slate-800"
                        )}>
                           <ReactMarkdown>
                              {m.role === 'assistant' && (m.data?.question_strategy?.options || []).length > 0
                                ? stripDuplicatedOptionsFromContent(m.content, m.data.question_strategy.options)
                                : m.content}
                           </ReactMarkdown>
                        </div>

                        {m.role === 'assistant' && m.data?.question_strategy?.options && (
                          <OptionSelectionBlock
                            options={m.data.question_strategy.options}
                            onSelect={(option) => {
                              const technicalValue = option.value || option.id || "";
                              
                              if (technicalValue === "other" || technicalValue === "outro_caminho") {
                                handleSend(
                                  "Quero seguir por outro caminho. Me ajude a explorar uma alternativa diferente das opções sugeridas.",
                                  {
                                    source: "assistant_option",
                                    selected_option: {
                                      letter: option.letter || null,
                                      title: (option as any).title || option.label || null,
                                      value: technicalValue
                                    }
                                  }
                                );
                                setIsOtherSelected(true);
                                setTimeout(() => textareaRef.current?.focus(), 0);
                                return;
                              }

                              const fullMessage = buildOptionMessage(option);
                              handleSend(fullMessage, {
                                source: "assistant_option",
                                selected_option: {
                                  letter: option.letter || null,
                                  title: (option as any).title || option.label || null,
                                  description: option.description || null,
                                  value: technicalValue
                                }
                              });
                            }}
                            allowsFreeText={m.data.question_strategy.allows_free_text}
                            onOther={() => {
                              handleSend(
                                "Quero seguir por outro caminho. Me ajude a explorar uma alternativa diferente das opções sugeridas.",
                                {
                                  source: "assistant_option",
                                  selected_option: {
                                    value: "outro_caminho",
                                    title: "Outro caminho"
                                  }
                                }
                              );
                              setIsOtherSelected(true);
                              setTimeout(() => textareaRef.current?.focus(), 0);
                            }}
                          />
                        )}

                      {m.role === 'assistant' && m.data?.suggested_replies && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {m.data.suggested_replies.map((reply: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => {
                                const intent = m.data?.type === 'reopen_point_followup' ? 'reopen_discussion_answer' : null;
                                handleSend(reply.value, intent ? { intent } : undefined);
                              }}
                              className="px-3 py-1.5 bg-white text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                            >
                              {reply.label}
                            </button>
                          ))}
                        </div>
                      )}

                        {m.data?.type === 'document_processed' && (
                           <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                                    <CheckCircle2 className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Documento Processado</p>
                                    <p className="text-[10px] font-bold text-emerald-600 truncate max-w-[200px]">{m.data.fileName}</p>
                                 </div>
                              </div>
                              <button 
                                onClick={() => onTabChange?.('documents')}
                                className="px-4 py-2 bg-white text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 hover:bg-emerald-50 transition-all flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver em Documentos
                              </button>
                           </div>
                        )}

                        {m.isError && (
                          <div className="mt-4 flex flex-col gap-3">
                             <div className="flex flex-wrap gap-2">
                                <button 
                                  onClick={() => handleSend(messages[idx-1]?.content)}
                                  className="px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-all flex items-center gap-2"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Tentar novamente
                                </button>
                                <button 
                                  onClick={() => setMessages(prev => prev.filter((_, listIdx) => listIdx !== idx))}
                                  className="px-4 py-2 bg-white text-rose-600 border border-rose-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-50 transition-all"
                                >
                                  Continuar sem MindFlow
                                </button>
                                {(adminCtx?.isOwner || adminCtx?.isAdmin) && (
                                  <button 
                                    onClick={() => setShowDiagnostics(true)}
                                    className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                                  >
                                    <Terminal className="w-3 h-3" />
                                    Ver diagnóstico
                                  </button>
                                )}
                             </div>
                          </div>
                        )}
                     </div>

                     {showDiagnostics && lastError && (adminCtx?.isOwner || adminCtx?.isAdmin) && (
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                         >
                            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                               <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center">
                                        <ShieldAlert className="w-6 h-6" />
                                     </div>
                                     <div>
                                        <h3 className="text-lg font-black tracking-tighter">Diagnóstico MindFlow</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Apenas para Administradores</p>
                                     </div>
                                  </div>
                                  <button 
                                    onClick={() => setShowDiagnostics(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                  >
                                    <ChevronDown className="w-6 h-6 rotate-180" />
                                  </button>
                               </div>

                               <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                     <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400">
                                           <User className="w-3 h-3" />
                                           <span className="text-[9px] font-black uppercase tracking-widest">Usuário</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-900 truncate">{user?.email}</p>
                                        <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{adminCtx?.isOwner ? 'OWNER' : 'ADMIN'}</p>
                                     </div>
                                     <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400">
                                           <Layers className="w-3 h-3" />
                                           <span className="text-[9px] font-black uppercase tracking-widest">Produto / Etapa</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
                                        <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{activeStage}</p>
                                     </div>
                                  </div>

                                  <div className="space-y-3">
                                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status do Sistema</h4>
                                     <div className="space-y-2">
                                        {[
                                          { label: 'Autenticado', value: !!user, icon: Lock },
                                          { label: 'LLM Provider', value: true, icon: Activity },
                                          { label: 'Firestore', value: !!db, icon: Database },
                                          { label: 'Pipeline Step', value: lastError.debug?.failedAt || 'N/A', icon: Terminal, isText: true }
                                        ].map((stat, idx) => (
                                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                             <div className="flex items-center gap-3">
                                                <stat.icon className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-600">{stat.label}</span>
                                             </div>
                                             {stat.isText ? (
                                               <span className="text-[10px] font-black text-indigo-600 uppercase italic truncate max-w-[150px]">{stat.value}</span>
                                             ) : (
                                               <div className={cn(
                                                 "w-2 h-2 rounded-full",
                                                 stat.value ? "bg-emerald-500" : "bg-rose-500"
                                               )} />
                                             )}
                                          </div>
                                        ))}
                                     </div>
                                  </div>

                                  <div className="space-y-3">
                                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Erro Técnico</h4>
                                     <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                                        <p className="text-xs font-black text-rose-900">{lastError.error?.type || 'UNKNOWN_ERROR'}</p>
                                        <p className="text-xs font-medium text-rose-700 leading-relaxed">{lastError.error?.message || lastError.debug?.originalError}</p>

                                        {(lastError.debug?.failedAt === 'fetching_stage_agent' || lastError.error?.step === 'fetching_stage_agent') && (
                                          <div className="mt-3 pt-3 border-t border-rose-200/50 space-y-2">
                                            <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Causa provável</p>
                                            <p className="text-xs text-rose-700">A leitura de <code className="bg-rose-100 px-1 rounded">stage_agent_configs</code> foi bloqueada pelo Firestore (Missing or insufficient permissions).</p>
                                            <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Correção recomendada</p>
                                            <ul className="text-xs text-rose-700 list-disc ml-4 space-y-1">
                                              <li>Publicar Firestore Rules liberando read para usuários autenticados na coleção <code className="bg-rose-100 px-1 rounded">stage_agent_configs</code>.</li>
                                              <li>O runtime já possui fallback local para esta etapa, então este erro foi blindado e não deve mais derrubar a conversa.</li>
                                            </ul>
                                          </div>
                                        )}
                                     </div>
                                  </div>

                                  {lastError.error?.stack && (
                                    <div className="space-y-3">
                                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Stack Trace</h4>
                                       <div className="p-4 bg-slate-900 rounded-2xl overflow-x-auto">
                                          <pre className="text-[10px] text-slate-400 font-mono leading-relaxed">
                                             {lastError.error.stack}
                                          </pre>
                                       </div>
                                    </div>
                                  )}
                               </div>

                               <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                                  <button 
                                    onClick={() => setShowDiagnostics(false)}
                                    className="px-6 py-3 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all"
                                  >
                                    Fechar Diagnóstico
                                  </button>
                               </div>
                            </div>
                         </motion.div>
                      )}

                     {m.data?.memory_updates?.length > 0 && (
                        <div className="flex flex-col gap-2 mt-4 w-full">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Memória estruturada pela Tona</span>
                           <div className="flex flex-wrap gap-2">
                              {m.data.memory_updates.map((upd: any, idx: number) => (
                                 <div 
                                   key={idx} 
                                   className={cn(
                                     "flex items-center gap-1.5 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-left transition-all",
                                     upd.classification === 'hypothesis' ? "bg-amber-50 border-amber-100 text-amber-600" :
                                     upd.classification === 'decision' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                                     "bg-emerald-50 border-emerald-100 text-emerald-600"
                                   )}
                                 >
                                    {upd.classification === 'hypothesis' ? <Lightbulb className="w-3 h-3" /> : 
                                     upd.classification === 'decision' ? <CheckCircle2 className="w-3 h-3" /> :
                                     <Brain className="w-3 h-3" />}
                                    {upd.label}
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}

                     {m.role === 'assistant' && m.data?.situational_product_interpretation && (
                        <div className="mt-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl w-full">
                          <div className="flex items-center gap-2 mb-3">
                             <Sparkles className="w-3 h-3 text-indigo-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Raciocínio Situacional</span>
                          </div>
                          <div className="space-y-2">
                             {m.data.situational_product_interpretation.likely_problem_hypotheses?.slice(0, 2).map((h: string, idx: number) => (
                               <div key={idx} className="flex gap-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                                  <span className="text-indigo-400 font-black">•</span>
                                  {h}
                               </div>
                             ))}
                          </div>
                        </div>
                     )}
                  </div>
              </motion.div>
            );
          })}

          {/* Remove the standalone StageReopenDiscussionCard as it's now inside the message loop */}

            {Object.entries(uploadTasks).map(([id, task]) => {
            if (task.phase === 'processed' || task.phase === 'failed') return null;
            return (
              <div key={id} className="flex gap-4 animate-in slide-in-from-bottom-2">
                 <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                 </div>
                 <div className="flex-1 max-w-[80%] bg-indigo-50 border border-indigo-100 rounded-[2rem] rounded-tl-none p-5 space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{task.message}</span>
                       <span className="text-[10px] font-black text-indigo-400">{Math.round(task.percent)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-indigo-500 transition-all duration-300" 
                         style={{ width: `${task.percent}%` }} 
                       />
                    </div>
                 </div>
              </div>
            );
          })}

          {loading && (
              <div className="flex gap-4">
                 <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 animate-pulse">
                    <Bot className="w-5 h-5 text-slate-400" />
                 </div>
                 <div className="flex items-center gap-2 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] rounded-tl-none">
                    <div className="flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                       <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                       <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 italic">Tona está organizando o raciocínio...</span>
                 </div>
              </div>
            )}
         </div>
      </div>

      <div className="p-8 border-t border-slate-200 space-y-6 shrink-0 bg-white sticky bottom-0">
         <div className="flex flex-wrap gap-2 max-w-full overflow-hidden">
            {finalQuickActions.map(s => (
               <button 
                 key={s}
                 onClick={() => {
                   if (stageCompleted) {
                     if (s === "Avançar para próxima etapa") {
                       handleGoToNextStage();
                       return;
                     }
                     if (s === "Rediscutir um ponto") {
                       handleStartReopenDiscussion();
                       return;
                     }
                     if (s === "Regenerar resumo inteligente") {
                       generateStageClosureAutomatically();
                       return;
                     }
                     if (s === "Anexar evidência final") {
                       setInput("Quero anexar uma evidência final para complementar esta etapa.");
                       textareaRef.current?.focus();
                       return;
                     }
                   }

                   if (s === 'Outro caminho') {
                     handleSend(
                       "Quero seguir por outro caminho. Me ajude a explorar uma alternativa diferente das opções sugeridas.",
                       {
                         source: "quick_action",
                         selected_option: {
                           value: "outro_caminho",
                           title: "Outro caminho"
                         }
                       }
                     );
                     setIsOtherSelected(true);
                     textareaRef.current?.focus();
                   } else {
                     handleSend(s, { source: "quick_action" });
                   }
                 }}
                 className={cn(
                   "px-4 py-2 border rounded-full text-[10px] font-black transition-all uppercase tracking-tight max-w-[180px] truncate whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0 shadow-sm",
                   s === "Me ajuda a pensar" || s === "Avançar para próxima etapa"
                     ? "bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100" 
                     : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900"
                 )}
               >
                 {s}
               </button>
            ))}
         </div>
         
         <div className="relative group">
            {isOtherSelected && (
              <div className="absolute top-[-28px] left-6 flex items-center gap-2 animate-in slide-in-from-bottom-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  Boa, {userName}. Me conta do seu jeito.
                </span>
              </div>
            )}
            <textarea 
              ref={textareaRef}
              rows={1}
              placeholder={permissions?.canCreateMessages ? inputPlaceholder : "Acesso de visualização ativa"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (permissions?.canCreateMessages) handleSend();
                }
              }}
              disabled={loading || !permissions?.canCreateMessages}
              className={cn(
                "w-full pl-6 pr-16 py-6 border rounded-[2.5rem] text-sm focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none max-h-48 min-h-[72px] font-medium text-slate-900 placeholder:text-slate-400 shadow-inner",
                !permissions?.canCreateMessages ? "bg-slate-50 border-slate-100 grayscale opacity-70 cursor-not-allowed" :
                isOtherSelected ? "bg-white border-indigo-200 ring-4 ring-indigo-50 font-bold" : "bg-slate-100 border-transparent focus:bg-white"
              )}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleFileAttachment}
                 accept=".pdf,.docx,.txt,.md,.markdown,.csv"
               />
               {permissions?.canUploadDocuments && <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"
               >
                  <Paperclip className="w-5 h-5" />
               </button>}
               <button 
                 onClick={() => handleSend()}
                 disabled={loading || !input.trim() || !permissions?.canCreateMessages}
                 className={cn(
                   "p-4 bg-indigo-600 text-white rounded-3xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-indigo-200",
                   !permissions?.canCreateMessages && "bg-slate-200 text-slate-400 shadow-none hover:bg-slate-200"
                 )}
               >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 translate-x-0.5 -translate-y-0.5" />}
               </button>
            </div>
         </div>
         
         <div className="flex items-center justify-between opacity-40 px-4">
            <div className="flex items-center gap-2">
               <Zap className="w-3.5 h-3.5" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Contexto: {activeStage.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Ativo</span>
               </div>
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">v1.2.4</span>
            </div>
         </div>
      </div>
    </div>
  );
});

export default AIAssistantPanel;

function StageClosureCard({ 
  closure, 
  progress, 
  onDiscussPoint, 
  onGoToNextStage, 
  onRegenerate 
}: { 
  closure: any; 
  progress: number; 
  onDiscussPoint: (point: any) => void;
  onGoToNextStage: () => void;
  onRegenerate: () => void;
}) {
  const sections = [
    { title: "Decisões", items: closure.decisions || [], icon: CheckCircle2, color: "text-indigo-600", bg: "bg-indigo-50", section: "decision" },
    { title: "Hipóteses", items: closure.hypotheses || [], icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50", section: "hypothesis" },
    { title: "Evidências", items: closure.facts || [], icon: Brain, color: "text-emerald-600", bg: "bg-emerald-50", section: "fact" },
    { title: "Riscos", items: closure.risks || [], icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-50", section: "risk" },
    { title: "Pendências", items: closure.pending_points || [], icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50", section: "pending" }
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-[40px] border border-slate-200 bg-white p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
           <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
             <CheckCircle2 size={32} />
           </div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
             <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full">Etapa Concluída</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{progress}% de Maturidade</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
            {closure.title || "Etapa consolidada"}
          </h2>
          {closure.needs_update && (
            <div className="flex items-center gap-2 mt-4">
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-widest animate-pulse border border-amber-200">
                Resumo desatualizado
              </span>
              <p className="text-[10px] font-bold text-slate-400 italic">
                Ponto reaberto para rediscussão
              </p>
            </div>
          )}
          <div className="mt-6 space-y-4">
             <p className="text-lg font-medium text-slate-600 leading-relaxed italic">
               "{closure.executive_summary || "O trabalho nesta etapa foi finalizado e os principais aprendizados foram consolidados."}"
             </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.filter(s => s.items.length > 0).map((section, idx) => (
          <div key={idx} className="rounded-[32px] border border-slate-100 bg-slate-50/50 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", section.bg, section.color)}>
                <section.icon size={20} />
              </div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">{section.title}</h4>
            </div>

            <div className="space-y-4">
              {section.items.map((item: any, i: number) => (
                <div key={i} className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-all">
                  <h5 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {item.description || item.validation_needed || item.suggested_action}
                  </p>
                  <button 
                    onClick={() => onDiscussPoint({ ...item, section: section.section })}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Rediscutir ponto"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[40px] bg-slate-900 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="max-w-md">
           <h4 className="text-xl font-black text-white tracking-tight">
             {closure.recommended_next_step?.title || "Pronto para o próximo passo?"}
           </h4>
           <p className="mt-2 text-sm font-medium text-slate-400">
             {closure.recommended_next_step?.description || "A etapa foi validada. Podemos avançar para garantir que o fatiamento e a visão de valor continuem evoluindo."}
           </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onRegenerate}
            className="px-6 py-4 rounded-2xl bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2"
          >
            <Sparkles size={16} />
            Atualizar Resumo
          </button>
          <button
            onClick={onGoToNextStage}
            className="px-10 py-5 rounded-2xl bg-indigo-600 text-white text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/20 flex items-center gap-3"
          >
            Avançar Etapa
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
