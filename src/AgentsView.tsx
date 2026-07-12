import { useState, useEffect } from 'react';
import { apiClient } from './shared/api-client';

export function AgentsView() {
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get<any[]>('/api/agents')
      .then(setAgents)
      .catch(console.error);
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Agents</h1>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {agents.map(agent => (
          <div key={agent.name} style={{ background: 'var(--bg-secondary)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{agent.name}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{agent.description}</p>
          </div>
        ))}
        {agents.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No agents available</div>}
      </div>
    </div>
  );
}
