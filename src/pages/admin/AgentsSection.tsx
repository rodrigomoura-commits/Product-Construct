import React, { useEffect, useState } from 'react';
import { 
  collection, query, getDocs, doc, setDoc, 
  serverTimestamp, onSnapshot, orderBy, 
  limit, addDoc, updateDoc, where 
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { 
  Bot, Loader2, Sparkles, Settings, Activity, 
  Tag, CheckCircle2, Search, Plus, Filter,
  Layers, FileText, History, FlaskConical,
  ChevronRight, MoreHorizontal, Copy, Trash2,
  AlertCircle, Edit3, Save, Zap, Brain, Target, 
  ArrowRight, Workflow, BookOpen, Clock, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../lib/utils';
import { Agent, AgentInstructionVersion, AgentFlowBinding, AgentTestRun, StageKey } from '../../types';

// Tab Components (defined below or in separate files)
import AgentListTab from './agents/AgentListTab';
import AgentFlowsTab from './agents/AgentFlowsTab';
import AgentInstructionsTab from './agents/AgentInstructionsTab';
import AgentVersionsTab from './agents/AgentVersionsTab';
import AgentTestsTab from './agents/AgentTestsTab';
import AgentEditorDrawer from './agents/AgentEditorDrawer';

const TABS = [
  { id: 'agents', label: 'Agentes', icon: Bot },
  { id: 'flows', label: 'Etapas', icon: Workflow },
  { id: 'instructions', label: 'Instruções', icon: BookOpen },
  { id: 'versions', label: 'Versões', icon: History },
  { id: 'tests', label: 'Testes', icon: FlaskConical },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AgentsAdminSection() {
  const [activeTab, setActiveTab] = useState<TabId>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // UI States
  const [isAgentEditorOpen, setIsAgentEditorOpen] = useState(false);
  const [agentForGlobalEdit, setAgentForGlobalEdit] = useState<Agent | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  
  useEffect(() => {
    const q = query(collection(db, 'agents'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Agent));
      setAgents(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const visibleAgents = agents.filter(a => showArchived || a.status !== 'archived');

  const handleEditAgent = (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (agent) {
      setAgentForGlobalEdit(agent);
      setIsAgentEditorOpen(true);
      setSelectedAgentId(id);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'agents': return (
        <AgentListTab 
          agents={visibleAgents} 
          loading={loading} 
          onEdit={handleEditAgent} 
          selectedId={selectedAgentId}
          setSelectedId={setSelectedAgentId}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
        />
      );
      case 'flows': return (
        <AgentFlowsTab 
          agents={visibleAgents} 
          onEditAgent={handleEditAgent}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
        />
      );
      case 'instructions': return (
        <AgentInstructionsTab 
          agents={visibleAgents} 
          selectedId={selectedAgentId} 
          setSelectedId={setSelectedAgentId} 
        />
      );
      case 'versions': return (
        <AgentVersionsTab 
          agents={visibleAgents} 
          selectedId={selectedAgentId} 
          setSelectedId={setSelectedAgentId}
        />
      );
      case 'tests': return (
        <AgentTestsTab 
          agents={visibleAgents} 
          selectedId={selectedAgentId} 
          setSelectedId={setSelectedAgentId}
        />
      );
      default: return null;
    }
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
                 <Bot className="text-white w-6 h-6" />
              </div>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Agent Studio da Tona</h2>
           </div>
           <p className="text-zinc-500 font-medium italic">Gerencie os agentes, instruções, etapas, outputs e versões usados pela Tona.</p>
        </div>
        
        <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
           {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === tab.id 
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" 
                    : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
           ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="min-h-[600px]">
         {renderTab()}
      </div>

      {/* Global Agent Editor Drawer */}
      <AnimatePresence>
        {isAgentEditorOpen && agentForGlobalEdit && (
          <AgentEditorDrawer 
            agent={agentForGlobalEdit} 
            onClose={() => {
              setIsAgentEditorOpen(false);
              setAgentForGlobalEdit(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
