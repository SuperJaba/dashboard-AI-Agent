import React, { useState } from 'react';
import { Swords, Loader2, ChevronDown } from 'lucide-react';
import { SplitDiffViewer } from './SplitDiffViewer';

interface Task {
  id: string;
  status: string;
  prompt: string;
}

interface AgentArenaButtonProps {
  task: Task;
  repoPath?: string;
}

const AVAILABLE_ARENA_AGENTS = [
  { id: 'claude', name: 'Claude 3.5 Sonnet' },
  { id: 'gemini', name: 'Gemini 1.5 Pro' },
  { id: 'antigravity', name: 'Antigravity CLI' },
  { id: 'aider', name: 'Aider Architect' },
  { id: 'openai', name: 'OpenAI o3-mini' }
];

export function AgentArenaButton({ task, repoPath }: AgentArenaButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeDiff, setActiveDiff] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');

  if (task.status !== 'completed') {
    return null;
  }

  const handleSelectAgent = async (agent: { id: string; name: string }) => {
    setDropdownOpen(false);
    setLoading(true);
    setSelectedAgentName(agent.name);

    try {
      const res = await fetch('/api/arena/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          agentCmd: agent.id,
          prompt: task.prompt,
          repoPath
        })
      });

      const data = await res.json();
      if (data.runId) {
        // Fetch diff
        const diffRes = await fetch(`/api/arena/runs/${data.runId}/diff`);
        const diffData = await diffRes.json();
        setActiveDiff(diffData.diff || '');
      }
    } catch (err) {
      console.error('Arena execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={loading}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
        ) : (
          <Swords className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span>Porównaj z innym agentem</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 py-2">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
            Wybierz agenta do pojedynku
          </div>
          {AVAILABLE_ARENA_AGENTS.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => handleSelectAgent(agent)}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-white transition flex items-center justify-between"
            >
              <span>{agent.name}</span>
              <span className="text-[10px] text-slate-500 font-mono">worktree</span>
            </button>
          ))}
        </div>
      )}

      {/* Split Diff Modal */}
      {activeDiff !== null && (
        <SplitDiffViewer
          diff={activeDiff}
          agentName={selectedAgentName}
          onClose={() => setActiveDiff(null)}
        />
      )}
    </div>
  );
}
