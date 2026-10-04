import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  GitBranch, GitCommit, GitPullRequest, AlertCircle, RefreshCw, 
  UploadCloud, ChevronDown, ChevronUp, X, CheckCircle2, Rocket,
  DownloadCloud, FileText, Plus, Check
} from 'lucide-react';
import { apiClient } from './shared/api-client';
import './index.css';

interface RepoStatusProps {
  directory: string;
  onLaunchTerminal?: (config: any) => void;
}

export const RepoStatus: React.FC<RepoStatusProps> = ({ directory, onLaunchTerminal }) => {
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [githubData, setGithubData] = useState<any>(null);
  const [branches, setBranches] = useState<{ current: string; local: string[]; remote: string[] }>({ current: '', local: [], remote: [] });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCommits, setShowCommits] = useState(false);
  const [showChanges, setShowChanges] = useState(true);
  const [showPRs, setShowPRs] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [newBranchMode, setNewBranchMode] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  
  // Modals
  const [diffModal, setDiffModal] = useState<{ show: boolean; diff: string; stat: string; staged: boolean; file: string | null } | null>(null);
  const [commitModal, setCommitModal] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [deployModal, setDeployModal] = useState<{ show: boolean; title: string; content: string; isError: boolean } | null>(null);

  const showNotification = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  }, []);

  const fetchRepoData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, ghData, branchData] = await Promise.all([
        apiClient.post<any>('/api/git/status', { directory }),
        apiClient.post<any>('/api/git/github', { directory }).catch(() => ({ prs: [], latestRun: null })),
        apiClient.post<any>('/api/git/branches', { directory }).catch(() => ({ current: '', local: [], remote: [] }))
      ]);

      if (statusData.error && statusData.error === 'Not a git repository') {
        setError('Not a git repository');
      } else {
        setGitStatus(statusData);
        setGithubData(ghData);
        if (branchData && !branchData.error) {
          setBranches(branchData);
        }
      }
    } catch (err: any) {
      if (err.message !== 'Not a git repository') {
        console.error(err);
      }
      setError(err.message || 'Failed to fetch repo data');
    }
    setLoading(false);
  }, [directory]);

  useEffect(() => {
    fetchRepoData();
  }, [fetchRepoData]);

  const handleCheckout = async (branchName: string) => {
    setActionLoading('checkout');
    try {
      const res = await apiClient.post<any>('/api/git/checkout', { directory, branch: branchName });
      if (res.error) {
        showNotification(`Checkout failed: ${res.error}`, 'error');
      } else {
        showNotification(`Switched to branch ${branchName}`);
        setShowBranchMenu(false);
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Checkout failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchInput.trim()) return;
    setActionLoading('create-branch');
    try {
      const res = await apiClient.post<any>('/api/git/checkout', { directory, branch: newBranchInput.trim(), createNew: true });
      if (res.error) {
        showNotification(`Create branch failed: ${res.error}`, 'error');
      } else {
        showNotification(`Created and switched to branch ${newBranchInput.trim()}`);
        setNewBranchMode(false);
        setNewBranchInput('');
        setShowBranchMenu(false);
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFetch = async () => {
    setActionLoading('fetch');
    try {
      const res = await apiClient.post<any>('/api/git/fetch', { directory });
      if (res.error) {
        showNotification(`Fetch failed: ${res.error}`, 'error');
      } else {
        showNotification('Git fetch complete');
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Fetch failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePull = async () => {
    setActionLoading('pull');
    try {
      const res = await apiClient.post<any>('/api/git/pull', { directory });
      if (res.error) {
        showNotification(`Pull failed: ${res.error}`, 'error');
      } else {
        showNotification('Git pull complete');
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Pull failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePush = async () => {
    setActionLoading('push');
    try {
      const res = await apiClient.post<any>('/api/git/push', { directory });
      if (res.error) {
        showNotification(`Push failed: ${res.error}`, 'error');
      } else {
        showNotification('Git push complete');
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Push failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDiff = async (staged = false, file: string | null = null) => {
    setActionLoading('diff');
    try {
      const res = await apiClient.post<any>('/api/git/diff', { directory, staged, file });
      if (res.error) {
        showNotification(`Diff failed: ${res.error}`, 'error');
      } else {
        setDiffModal({
          show: true,
          diff: res.diff || 'No differences found.',
          stat: res.stat || '',
          staged,
          file
        });
      }
    } catch (err: any) {
      showNotification(`Diff failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStage = async (files: string | string[]) => {
    setActionLoading('stage');
    try {
      const res = await apiClient.post<any>('/api/git/stage', { directory, files });
      if (res.error) {
        showNotification(`Stage failed: ${res.error}`, 'error');
      } else {
        showNotification('Files staged');
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Stage failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnstage = async (files: string | string[]) => {
    setActionLoading('unstage');
    try {
      const res = await apiClient.post<any>('/api/git/unstage', { directory, files });
      if (res.error) {
        showNotification(`Unstage failed: ${res.error}`, 'error');
      } else {
        showNotification('Files unstaged');
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Unstage failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setActionLoading('commit');
    try {
      const res = await apiClient.post<any>('/api/git/commit', { directory, message: commitMessage.trim() });
      if (res.error) {
        showNotification(`Commit failed: ${res.error}`, 'error');
      } else {
        showNotification('Commit created successfully');
        setCommitModal(false);
        setCommitMessage('');
        await fetchRepoData();
      }
    } catch (err: any) {
      showNotification(`Commit failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

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
    return null;
  }

  return (
    <div className="glass-card animate-in delay-3" style={{ maxWidth: '100%', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            <GitPullRequest size={24} color="var(--primary)" />
            Repository
          </h2>

          {/* Branch Switcher Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#F59E0B',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Click to switch or create branch"
            >
              <GitBranch size={16} />
              <span>{gitStatus?.branch || branches.current || 'branch'}</span>
              <ChevronDown size={14} />
            </button>

            {showBranchMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 100,
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                minWidth: '220px',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Branches
                </div>
                
                {branches.local.map(b => (
                  <button
                    key={b}
                    onClick={() => handleCheckout(b)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: b === (gitStatus?.branch || branches.current) ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      border: 'none',
                      color: b === (gitStatus?.branch || branches.current) ? '#F59E0B' : 'var(--text-main)',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span>{b}</span>
                    {b === (gitStatus?.branch || branches.current) && <Check size={14} />}
                  </button>
                ))}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.3rem', paddingTop: '0.4rem' }}>
                  {!newBranchMode ? (
                    <button
                      onClick={() => setNewBranchMode(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      <Plus size={14} /> New Branch...
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <input
                        type="text"
                        placeholder="branch-name"
                        value={newBranchInput}
                        onChange={e => setNewBranchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); }}
                        autoFocus
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          color: '#fff',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.8rem'
                        }}
                      />
                      <button
                        onClick={handleCreateBranch}
                        style={{
                          background: 'var(--primary)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Create
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleFetch}
            className="btn-add-project"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            disabled={loading || !!actionLoading}
            title="Fetch from remote"
          >
            <RefreshCw size={14} className={actionLoading === 'fetch' ? 'spin' : ''} />
            Fetch
          </button>

          <button 
            onClick={handlePull}
            className="btn-add-project"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            disabled={loading || !!actionLoading}
            title="Pull latest changes"
          >
            <DownloadCloud size={14} className={actionLoading === 'pull' ? 'spin' : ''} />
            Pull
          </button>

          <button 
            onClick={handlePush}
            className="btn-add-project"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            disabled={loading || !!actionLoading}
            title="Push commits to remote"
          >
            <UploadCloud size={14} className={actionLoading === 'push' ? 'spin' : ''} />
            Push
          </button>

          <button 
            onClick={() => handleOpenDiff(false)}
            className="btn-add-project"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            disabled={loading || !!actionLoading}
            title="View Working Tree Diff"
          >
            <FileText size={14} />
            Diff
          </button>

          <button 
            onClick={() => setCommitModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            disabled={loading || !!actionLoading}
            title="Commit changes"
          >
            <GitCommit size={14} />
            Commit
          </button>

          <button 
            onClick={fetchRepoData}
            className="btn-add-project"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
            disabled={loading}
            title="Refresh status"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {actionMessage && (
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: actionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          color: actionMessage.type === 'error' ? '#f87171' : '#34d399',
          border: `1px solid ${actionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
        }}>
          {actionMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {actionMessage.text}
        </div>
      )}

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
          
          {/* Git Local Status & Changes */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div 
                className="info-label"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setShowChanges(!showChanges)}
              >
                <span>Uncommitted Changes ({gitStatus?.changes?.length || 0})</span>
                {showChanges ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {gitStatus?.changes?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => handleStage('.')}
                    style={{
                      padding: '2px 6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                    title="Stage all changes"
                  >
                    Stage All
                  </button>
                  <button
                    onClick={() => handleUnstage('.')}
                    style={{
                      padding: '2px 6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                    title="Unstage all changes"
                  >
                    Unstage All
                  </button>
                </div>
              )}
            </div>
            
            {showChanges && (
              <div style={{ marginBottom: '1rem' }}>
                {gitStatus?.changes?.length > 0 ? (
                  <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {gitStatus.changes.map((c: string, i: number) => {
                      const statusType = c.substring(0, 2).trim();
                      const fileName = c.substring(3).trim();
                      return (
                        <div 
                          key={i} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '0.2rem 0.4rem', 
                            background: 'rgba(255,255,255,0.02)', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleOpenDiff(false, fileName)}
                          title={`Click to view diff for ${fileName}`}
                        >
                          <span style={{ color: statusType === 'M' ? '#F59E0B' : statusType === '??' ? '#38bdf8' : '#10B981' }}>
                            {c}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>view diff</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle2 size={14} /> Working tree clean
                  </span>
                )}
              </div>
            )}

            {/* Commits Section */}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
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
                      fetchRepoData();
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

      {/* Diff Viewer Modal */}
      {diffModal && diffModal.show && ReactDOM.createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDiffModal(null); }}
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
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '850px',
            padding: '1.75rem',
            position: 'relative',
            animation: 'modalIn 0.2s ease-out',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button
              onClick={() => setDiffModal(null)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0.375rem',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} />
                {diffModal.file ? `Diff: ${diffModal.file}` : 'Working Tree Diff'}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginRight: '2rem' }}>
                <button
                  onClick={() => handleOpenDiff(false, diffModal.file)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    border: 'none',
                    cursor: 'pointer',
                    background: !diffModal.staged ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    color: '#fff'
                  }}
                >
                  Unstaged
                </button>
                <button
                  onClick={() => handleOpenDiff(true, diffModal.file)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    border: 'none',
                    cursor: 'pointer',
                    background: diffModal.staged ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    color: '#fff'
                  }}
                >
                  Staged
                </button>
              </div>
            </div>

            {diffModal.stat && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontFamily: 'var(--mono)' }}>
                {diffModal.stat}
              </div>
            )}

            <div style={{
              background: '#020617',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.75rem',
              padding: '1rem',
              overflowY: 'auto',
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {diffModal.diff.split(/\r?\n/).map((line, idx) => {
                let color = '#cbd5e1';
                let bg = 'transparent';
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  color = '#34d399';
                  bg = 'rgba(16, 185, 129, 0.1)';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  color = '#f87171';
                  bg = 'rgba(239, 68, 68, 0.1)';
                } else if (line.startsWith('@@')) {
                  color = '#38bdf8';
                  bg = 'rgba(56, 189, 248, 0.08)';
                }
                return (
                  <div key={idx} style={{ color, background: bg, padding: '1px 4px', borderRadius: '2px' }}>
                    {line || ' '}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setDiffModal(null)}
                className="btn-add-project"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Commit Modal */}
      {commitModal && ReactDOM.createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setCommitModal(false); }}
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
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '560px',
            padding: '1.75rem',
            position: 'relative',
            animation: 'modalIn 0.2s ease-out',
          }}>
            <button
              onClick={() => setCommitModal(false)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0.375rem',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <GitCommit size={22} />
              Create Commit
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Commit Message
              </label>
              <textarea
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="feat(core): add new feature..."
                rows={4}
                style={{
                  width: '100%',
                  background: '#020617',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleStage('.')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Stage All
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setCommitModal(false)}
                  className="btn-add-project"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                  disabled={!commitMessage.trim() || actionLoading === 'commit'}
                >
                  {actionLoading === 'commit' ? 'Committing...' : 'Commit'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Deploy Modal */}
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
              }}
            >
              <X size={18} />
            </button>

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
};