import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Product, ProductStage, StageKey, StageField, ConversationMemory } from '../../types';
import { 
  Bot, Send, Loader2, Sparkles, User, 
  MessageSquare, ChevronDown, CheckCircle2, 
  AlertCircle, Zap, RefreshCw, Layers, Paperclip,
  ArrowRight, Brain, Lightbulb, Check, ShieldAlert,
  Terminal, Activity, Lock, Database
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../../lib/firebase';
import { calculateProductMaturity } from '../../lib/maturity';
import { retrieveMindflowContext, extractMindflowLearning } from '../../lib/mindflow';
import { storeUserMemory } from '../../lib/mindflowContext';

import { runTonaConversationTurn, MindflowTurnResult } from '../../lib/tonaRuntime';

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
}

export default function AIAssistantPanel({ product, activeStage, stages }: AIAssistantPanelProps) {
  const { user, profile, adminCtx } = useAuth();
  const userName = profile?.display_name?.split(' ')[0] || 'você';
  const [conversationMemory, setConversationMemory] = useState<ConversationMemory | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [lastError, setLastError] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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

  function buildFallbackOptionsFromMemory(stage: StageKey = 'sense') {
    // Stage-specific fallback options
    if (stage === 'sense') {
      return [
        {
          id: "method_gap",
          letter: "A",
          label: "Falta de método de fatiamento",
          short_label: "Falta de método",
          description: "A squad quer quebrar, mas não sabe como fatiar sem perder coerência de valor."
        },
        {
          id: "scope_pressure",
          letter: "B",
          label: "Pressão por escopo fechado",
          short_label: "Pressão de escopo",
          description: "Existe uma percepção de que o valor só aparece se a iniciativa inteira for entregue."
        },
        {
          id: "technical_coupling",
          letter: "C",
          label: "Acoplamento técnico/processual",
          short_label: "Acoplamento",
          description: "As partes dependem umas das outras e parecem impedir uma entrega menor funcional."
        },
        {
          id: "granularity_issue",
          letter: "D",
          label: "Granularidade inconsistente",
          short_label: "Granularidade",
          description: "Os épicos acabam grandes ou pequenos demais para guiar bem priorização e execução."
        },
        {
          id: "other",
          letter: null,
          label: "Outro caminho",
          short_label: "Outro caminho",
          description: `Se você enxerga outro motivo, ${userName}, me conta o que foi.`
        }
      ];
    }

    // Default fallback
    return [
      { id: "more_detail", letter: "A", label: "Preciso de mais detalhes", short_label: "Mais detalhes", description: "Vamos aprofundar no que já temos." },
      { id: "new_perspective", letter: "B", label: "Mudar perspectiva", short_label: "Nova visão", description: "Vamos olhar por outro ângulo." },
      { id: "other", letter: null, label: "Outro caminho", short_label: "Outro", description: "Tenho outra ideia." }
    ];
  }


  useEffect(() => {
    if (product.id && user?.uid) {
      const initAssistant = async () => {
        setInitializing(true);
        try {
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
          const stageMaturity = stageData?.progress || 0;

          // 4. Determine opening mode
          const hasConversationMemory = !!convMem?.conversation_summary;
          const hasProductMemory = productMemory.length > 0;
          const hasMaturity = stageMaturity > 0;
          const hasPendingQuestion = !!convMem?.pending_question;

          const isResume = hasConversationMemory || hasProductMemory || hasMaturity || hasPendingQuestion;

          // 5. Backfill conversation memory if missing but product has memory
          if (!hasConversationMemory && isResume) {
            const initialSummary = `A etapa ${stages.find(s => s.stage_key === activeStage)?.name || activeStage.toUpperCase()} já possui ${productMemory.length} itens salvos. Maturidade em ${stageMaturity}%. Ainda há lacunas a explorar.`;
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

          if (isResume) {
            // 5. Ensure conversation memory exists and is populated
            let currentConvMem = convMem;
            if (!hasConversationMemory) {
              const initialSummary = `A etapa ${stages.find(s => s.stage_key === activeStage)?.name || activeStage.toUpperCase()} já possui ${productMemory.length} itens salvos. Maturidade em ${stageMaturity}%. Ainda há lacunas a explorar.`;
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

  async function updateStructuredMemory(update: StructuredAIResponse) {
    if (!product.id) return;

    // 1. Update Fields (Memory)
    const fieldsPath = `products/${product.id}/fields`;
    for (const mem of update.memory_updates) {
      try {
        const q = query(collection(db, fieldsPath), where('field_key', '==', mem.field_key), where('stage_key', '==', update.stage_focus));
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
            stage_key: update.stage_focus,
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
      } catch (e) {
        console.error("Error updating field:", e);
      }
    }

    // 2. Update Stage Maturity
    if (update.maturity_update) {
      const stageRef = doc(db, `products/${product.id}/stages`, update.maturity_update.stage_key);
      try {
        const newStageProgress = Math.min(100, Math.max(0, update.maturity_update.new_score));
        await updateDoc(stageRef, {
          progress: newStageProgress,
          updated_at: serverTimestamp()
        });

        // Sync product progress
        const updatedStages = stages.map(s => 
          s.stage_key === update.maturity_update.stage_key 
            ? { ...s, progress: newStageProgress } 
            : s
        );
        const newOverallProgress = calculateProductMaturity(updatedStages);
        await updateDoc(doc(db, 'products', product.id), {
          progress: newOverallProgress,
          updated_at: serverTimestamp()
        });
      } catch (e) {
        console.error("Error updating stage maturity:", e);
      }
    }

    // 3. Update Conversation Memory
    if (update.conversation_memory_update && user?.uid) {
      const memRef = doc(db, `products/${product.id}/conversation_memory`, user.uid);
      try {
        const dataToSave = {
          ...update.conversation_memory_update,
          status: 'active', // Ensure status is always present for validation
          product_id: product.id,
          user_id: user.uid,
          updated_at: serverTimestamp()
        };
        
        // Remove undefined fields
        Object.keys(dataToSave).forEach(key => (dataToSave as any)[key] === undefined && delete (dataToSave as any)[key]);

        await setDoc(memRef, dataToSave, { merge: true });
        
        // Update local state
        setConversationMemory(prev => ({ ...prev, ...dataToSave } as ConversationMemory));
      } catch (e) {
        console.error("Error updating conversation memory:", e);
      }
    }
  }

  async function handleSend(customMessage?: string) {
    const userMsg = customMessage || input.trim();
    if (!userMsg || loading) return;

    if (!customMessage) setInput('');
    setIsOtherSelected(false);
    
    // 1. Salvar mensagem do usuário localmente primeiro
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setLastError(null);

    try {
      // 2. Montar contexto e chamar MindFlow
      // Nota: runTonaConversationTurn agora lida com o salvamento das interações no Firestore
      const result: MindflowTurnResult = await runTonaConversationTurn({
        userId: user?.uid || '',
        userIdentifier: profile?.display_name || user?.email || undefined,
        userMessage: userMsg,
        userEmail: user?.email || undefined,
        productId: product.id,
        stageId: activeStage,
        agentId: 'tona_orchestrator',
        rawPayload: { 
          conversation_count: messages.length,
          role: adminCtx?.isOwner ? 'OWNER' : adminCtx?.isAdmin ? 'ADMIN' : 'USER'
        }
      });

      if (result.ok) {
        // Sucesso: Mapear para estrutura local se necessário
        const aiData: any = {
          assistant_message: result.reply,
          memory_updates: result.memoryUpdates?.map(r => ({
             field_key: r.classification,
             label: r.classification,
             value: r.content,
             classification: 'fact',
             confidence: r.confidence_score,
             source: 'chat'
          })),
          next_best_question: result.reply.split('?').pop()?.trim() || '', // heurística simples
          ...result.stageUpdates
        };

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.reply,
          data: aiData
        }]);
      } else {
        // Erro recuperável
        setLastError(result);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.reply,
          isError: true,
          data: result.debug
        }]);
      }

    } catch (e: any) {
      console.error("Tona Runtime Fatal Error:", e);
      const fatalError = {
        ok: false,
        reply: "Tive um problema técnico ao consultar o MindFlow agora, mas a conversa foi preservada. Podemos tentar novamente ou seguir a partir da etapa atual.",
        error: {
          type: "FATAL_UI_ERROR",
          message: e.message || String(e),
          step: "handleSend",
          recoverable: true
        },
        debug: {
          pipeline: "mindflow",
          failedAt: "handleSend",
          originalError: e.message || String(e),
          timestamp: new Date().toISOString()
        }
      };
      setLastError(fatalError);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: fatalError.reply,
        isError: true,
        data: fatalError.debug
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    await handleSend("Retome a conversa a partir do último estado salvo do produto e da etapa ativa.");
  }

  const currentMessageData = messages[messages.length - 1]?.data;
  const isResumeMode = messages.length === 1 && messages[0].content.includes('retomando de onde paramos');

  const defaultQuickActions = isResumeMode ? [
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

  // Dynamic quick actions for options
  const optionQuickActions = activeOptions.map((opt: any) => 
    opt.id === 'other' ? "Outro caminho" : (opt.letter ? `Escolher ${opt.letter}` : humanizeOptionLabel(opt))
  ) || [];

  const displayQuickActions = optionQuickActions.length > 0 
    ? ["Me ajuda a pensar", ...optionQuickActions] 
    : quickActions;

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

         {conversationMemory?.pending_question && (
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
                     Maturidade: {conversationMemory.last_maturity_snapshot?.[activeStage] || 0}%
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
            {messages.map((m, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
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
                              {m.content}
                           </ReactMarkdown>
                        </div>

                        {m.isError && (
                          <div className="mt-4 flex flex-col gap-3">
                             <div className="flex flex-wrap gap-2">
                                <button 
                                  onClick={() => handleSend(messages[i-1]?.content)}
                                  className="px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-all flex items-center gap-2"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Tentar novamente
                                </button>
                                <button 
                                  onClick={() => setMessages(prev => prev.filter((_, idx) => idx !== i))}
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

                      {m.role === 'assistant' && m.data?.question_strategy?.options?.length > 0 && (
                        <div className="mt-6 flex flex-col gap-4 w-full">
                           <div className="grid grid-cols-1 gap-3">
                              {m.data.question_strategy.options.map((opt: any) => (
                                 <button 
                                   key={opt.id}
                                   onClick={() => {
                                     if (opt.id === 'other') {
                                       setIsOtherSelected(true);
                                       if (textareaRef.current) {
                                         textareaRef.current.focus();
                                       }
                                     } else {
                                       const label = humanizeOptionLabel(opt);
                                       setInput(prev => prev ? `${prev}, ${label}` : label);
                                     }
                                   }}
                                   className={cn(
                                     "flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-2xl transition-all text-left group relative backdrop-blur-sm w-full overflow-hidden",
                                     "hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-0.5",
                                     (input === opt.id || input.includes(humanizeOptionLabel(opt))) && "border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600 shadow-lg shadow-indigo-100"
                                   )}
                                 >
                                    <div className={cn(
                                       "w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 transition-all uppercase",
                                       (input === opt.id || input.includes(humanizeOptionLabel(opt))) 
                                         ? "bg-indigo-600 text-white" 
                                         : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                                    )}>
                                       {(input === opt.id || input.includes(humanizeOptionLabel(opt))) ? <Check className="w-4 h-4" /> : (opt.letter || opt.id.slice(0, 1))}
                                    </div>
                                    <div className="flex flex-col pr-2 overflow-hidden w-full">
                                       <span className={cn(
                                         "text-[13px] font-black tracking-tight transition-colors line-clamp-1",
                                         (input === opt.id || input.includes(humanizeOptionLabel(opt))) ? "text-indigo-900" : "text-slate-900"
                                       )}>{opt.label}</span>
                                       <span className="text-[11px] text-slate-400 font-medium leading-relaxed group-hover:text-slate-500 transition-colors line-clamp-2">
                                          {opt.description}
                                       </span>
                                    </div>
                                    <div className={cn(
                                      "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
                                      input.includes(opt.id) ? "bg-indigo-600 border-indigo-600 opacity-100" : "border-slate-300"
                                    )}>
                                      <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        input.includes(opt.id) ? "bg-white" : "bg-transparent"
                                      )} />
                                    </div>
                                 </button>
                              ))}
                           </div>
                           <div className="flex items-start gap-2 px-1">
                              <Sparkles className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase tracking-wider">
                                 Essas opções são só um ponto de partida. Se fizer mais sentido, você pode combinar ideias ou seguir por outro caminho.
                              </p>
                           </div>
                        </div>
                     )}
                  </div>
              </motion.div>
            ))}
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
            {displayQuickActions.map(s => (
               <button 
                 key={s}
                 onClick={() => {
                   if (s === 'Outro caminho') {
                     setIsOtherSelected(true);
                     textareaRef.current?.focus();
                   } else {
                     setInput(s);
                     handleSend();
                   }
                 }}
                 className={cn(
                   "px-4 py-2 border rounded-full text-[10px] font-black transition-all uppercase tracking-tight max-w-[180px] truncate whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0 shadow-sm",
                   s === "Me ajuda a pensar" 
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
              placeholder={inputPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className={cn(
                "w-full pl-6 pr-16 py-6 border rounded-[2.5rem] text-sm focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none max-h-48 min-h-[72px] font-medium text-slate-900 placeholder:text-slate-400 shadow-inner",
                isOtherSelected ? "bg-white border-indigo-200 ring-4 ring-indigo-50 font-bold" : "bg-slate-100 border-transparent focus:bg-white"
              )}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
               <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
                  <Paperclip className="w-5 h-5" />
               </button>
               <button 
                 onClick={() => handleSend()}
                 disabled={loading || !input.trim()}
                 className="p-4 bg-indigo-600 text-white rounded-3xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-indigo-200"
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
}
