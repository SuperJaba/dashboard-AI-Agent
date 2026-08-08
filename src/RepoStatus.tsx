import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { GitBranch, GitCommit, GitPullRequest, AlertCircle, RefreshCw, UploadCloud, ChevronDown, ChevronUp, X, CheckCircle2, Rocket } from 'lucide-react';
import { apiClient } from './shared/api-client';
import './index.css';

interface RepoStatusProps {
  directory: string;
  onLaunchTerminal?: (config: any) => void;
}

export const RepoStatus: React.FC<RepoStatusProps> = ({ directory, onLaunchTerminal }) => {
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [githubData, setGithubData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCommits, setShowCommits] = useState(false);
  const [showPRs, setShowPRs] = useState(false);
  const [deployModal, setDeployModal] = useState<{show: boolean, title: string, content: string, isError: boolean} | null>(null);

  const fetchRepoData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, ghData] = await Promise.all([
        apiClient.post<any>('/api/git/status', { directory }),
        apiClient.post<any>('/api/git/github', { directory })
      ]);

      if (statusData.error && statusData.error === 'Not a git repository') {
        setError('Not a git repository');
      } else {
        setGitStatus(statusData);
        setGithubData(ghData);
      }
    } catch (err: any) {
      if (err.message !== 'Not a git repository') {
        console.error(err);
      }
      setError(err.message || 'Failed to fetch repo data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRepoData();
  }, [directory]);

  const handleCancelAllCI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await apiClient.post<any>('/api/git/cancel-ci', { directory });
      await fetchRepoData();
    } catch (err) {
      console.error('Failed to cancel CI', err);
    } finally {
      setLoading(false);
    }
  };

  if (error === 'Not a git repository') {
    return null; // Don't show anything if it's not a git repo
  }

  return (
    <div className="glass-card animate-in delay-3" style={{ maxWidth: '100%', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <GitPullRequest size={24} color="var(--primary)" />
          Repository Status
        </h2>
        <button 
          onClick={fetchRepoData}
          className="btn-add-project"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && !gitStatus ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading repository data...
        </div>
      ) : error && error !== 'Not a git repository' ? (
        <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Git Local Status */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <GitBranch size={18} color="#F59E0B" />
              Local Branch: <span style={{ color: '#F59E0B' }}>{gitStatus?.branch || 'unknown'}</span>
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <div className="info-label" style={{ marginBottom: '0.5rem' }}>Uncommitted Changes ({gitStatus?.changes?.length || 0})</div>
              {gitStatus?.changes?.length > 0 ? (
                <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                  {gitStatus.changes.map((c: string, i: number) => (
                    <div key={i}>{c}</div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.85rem', color: '#10B981' }}>Working tree clean</span>
              )}
            </div>

            <div>
              <div 
                className="info-label" 
                style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setShowCommits(!showCommits)}
              >
                Recent Commits
                {showCommits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              
              {showCommits && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {gitStatus?.commits?.map((c: any, i: number) => (
                    <div key={i} style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{c.msg}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{c.time}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <GitCommit size={12} /> {c.hash} by {c.author}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* GitHub PRs & CI */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', cursor: 'pointer' }} 
              onClick={() => setShowPRs(!showPRs)}
            >
              <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitPullRequest size={18} />
                Pull Requests
                {showPRs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {githubData?.latestRun && (
                  <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: githubData.latestRun.conclusion === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: githubData.latestRun.conclusion === 'success' ? '#10B981' : '#F59E0B' }}>
                    CI: {githubData.latestRun.conclusion || githubData.latestRun.status}
                  </div>
                )}
                <button 
                  onClick={handleCancelAllCI}
                  style={{
                    padding: '2px 8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                  title="Anuluj wszystkie zadania CI"
                >
                  Cancel All
                </button>
              </div>
            </div>

            {showPRs && (
              githubData?.prs?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {githubData.prs.map((pr: any, i: number) => (
                    <a key={i} href={pr.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px', borderLeft: '2px solid #10B981', transition: 'background 0.2s' }}>
                        <div style={{ color: 'var(--text-main)', marginBottom: '4px' }}>{pr.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>#{pr.number} • {pr.state}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No open pull requests found or gh not authenticated.</div>
              )
            )}
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(135deg, #10B981, #059669)', opacity: loading ? 0.7 : 1 }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const data = await apiClient.post<any>('/api/git/deploy', { directory });
                    if (data.error) {
                      setDeployModal({
                        show: true,
                        title: 'Deploy Error',
                        content: `${data.error}\n${data.stdout || ''}`,
                        isError: true
                      });
                    } else {
                      setDeployModal({
                        show: true,
                        title: 'Deploy Success',
                        content: data.log || 'Deployed successfully',
                        isError: false
                      });
                      fetchRepoData(); // refresh status
                    }
                  } catch (e: any) {
                    setDeployModal({
                      show: true,
                      title: 'Request Failed',
                      content: e.message,
                      isError: true
                    });
                  }
                  setLoading(false);
                }}
              >
                <UploadCloud size={18} />
                {loading ? 'Deploying...' : 'Sync & Deploy Remote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deployModal && deployModal.show && ReactDOM.createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDeployModal(null); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: deployModal.isError ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(16,185,129,0.4)',
            boxShadow: deployModal.isError
              ? '0 0 0 1px rgba(239,68,68,0.1), 0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.1)'
              : '0 0 0 1px rgba(16,185,129,0.1), 0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(16,185,129,0.1)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '680px',
            padding: '1.75rem',
            position: 'relative',
            animation: 'modalIn 0.2s ease-out',
          }}>
            {/* Close X */}
            <button
              onClick={() => setDeployModal(null)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0.375rem',
                display: 'flex', alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <X size={18} />
            </button>

            {/* Title */}
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              color: deployModal.isError ? '#f87171' : '#34d399',
            }}>
              {deployModal.isError ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />}
              {deployModal.title}
            </h3>

            {/* Content */}
            <div style={{
              background: '#020617',
              border: deployModal.isError ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)',
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              maxHeight: '55vh',
              overflowY: 'auto',
              color: '#cbd5e1',
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {deployModal.content}
            </div>

            {/* Footer */}
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.25rem' }}>
              {deployModal.isError && onLaunchTerminal && (
                <button
                  onClick={async () => {
                    try {
                      const data = await apiClient.post<any>('/api/deploy', {
                          agent: 'agy',
                          directory,
                          tasks: [{ id: 'error-fix', title: `Fix this deployment error:\n\n${deployModal.content}`, status: 'pending' }],
                          useBrowserTerminal: true
                      });
                      if (data.browserTerminal) {
                        onLaunchTerminal({ command: data.command, args: data.args, cwd: data.cwd, env: data.env });
                        setDeployModal(null);
                      }
                    } catch (e) { console.error('Failed to launch agent', e); }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: 'white', padding: '0.6rem 1.25rem',
                    borderRadius: '0.625rem', fontWeight: 600, fontSize: '0.875rem',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                  }}
                >
                  <Rocket size={16} /> Wyślij do Agenta
                </button>
              )}
              <button
                onClick={() => setDeployModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', padding: '0.6rem 1.5rem',
                  borderRadius: '0.625rem', fontWeight: 500, fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
