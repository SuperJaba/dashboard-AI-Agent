import { useState, useEffect } from 'react';
import { apiClient } from './shared/api-client';
import { AgentSchema } from './shared/api-client/schemas';
import type { AgentData } from './shared/api-client/schemas';
import { z } from 'zod';

export function AgentsView() {
  const [agents, setAgents] = useState<AgentData[]>([]);

  useEffect(() => {
    apiClient.get<unknown>('/api/agents')
      .then(data => {
        const parsed = z.array(AgentSchema).parse(data);
        setAgents(parsed);
      })
      .catch(console.error);
  }, []);

  return (
    <div style={{
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      backgroundColor: '#000',
      color: '#00FF41',
      padding: '2rem',
      minHeight: '100%',
      letterSpacing: '-0.02em',
      boxSizing: 'border-box'
    }}>
      <h1 style={{ 
        fontSize: '2rem', 
        fontWeight: '800', 
        textTransform: 'uppercase', 
        borderBottom: '2px solid #333', 
        paddingBottom: '1rem',
        marginBottom: '2rem'
      }}>AGENCI AI / ZASOBY</h1>
      
      <div className="industrial-grid">
        {agents.map(agent => (
          <div key={agent.name} className="industrial-tile">
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', textTransform: 'uppercase' }}>
              <span style={{ color: '#00FF41', marginRight: '0.5rem' }}>&gt;</span>
              {agent.name}
            </h3>
            <p style={{ margin: 0, color: '#888', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {agent.description}
            </p>
          </div>
        ))}
        {agents.length === 0 && (
          <div style={{ color: '#888', padding: '1.5rem', border: '2px dashed #333' }}>
            [BRAK AGENTÓW_]
          </div>
        )}
      </div>
    </div>
  );
}
