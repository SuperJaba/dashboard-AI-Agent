import { useState, useEffect } from 'react';
import { apiClient } from './shared/api-client';

export function RepoStatus({ directory }: { directory: string, onLaunchTerminal?: (config: any) => void }) {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    if (!directory) return;
    apiClient.get<any>(`/api/git-status?dir=${encodeURIComponent(directory)}`)
      .then(setStatus)
      .catch(console.error);
  }, [directory]);

  if (!status) return null;

  return (
    <div style={{ padding: '1rem', background: '#111', border: '1px solid #333', marginTop: '1rem', fontFamily: 'monospace' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#00FF41' }}>GIT STATUS</h3>
      <div style={{ color: '#aaa' }}>Branch: <span style={{ color: '#fff' }}>{status.branch}</span></div>
      <div style={{ color: '#aaa', marginTop: '0.5rem' }}>Modified: {status.modified?.length || 0}</div>
      <div style={{ color: '#aaa' }}>Untracked: {status.untracked?.length || 0}</div>
    </div>
  );
}
