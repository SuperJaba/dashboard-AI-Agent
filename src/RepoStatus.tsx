import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, GitPullRequest, AlertCircle, RefreshCw, UploadCloud, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from './api';
import './index.css';

interface RepoStatusProps {
  directory: string;
}

export const RepoStatus: React.FC<RepoStatusProps> = ({ directory }) => {
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [githubData, setGithubData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCommits, setShowCommits] = useState(false);
  const [showPRs, setShowPRs] = useState(false);

  const fetchRepoData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, ghRes] = await Promise.all([
        apiFetch('http://localhost:3001/api/git/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directory })
        }),
        apiFetch('http://localhost:3001/api/git/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directory })
        })
      ]);

      const statusData = await statusRes.json();
      const ghData = await ghRes.json();

      if (statusData.error && statusData.error === 'Not a git repository') {
        setError('Not a git repository');
      } else {
        setGitStatus(statusData);
        setGithubData(ghData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch repo data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRepoData();
  }, [directory]);

  if (error === 'Not a git repository') {
    return null; // Don't show anything if it's not a git repo
  }

  return (
    <div className="glass-card animate-in delay-3" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitPullRequest size={18} />
                Pull Requests
              </h3>
              {githubData?.latestRun && (
                <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: githubData.latestRun.conclusion === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: githubData.latestRun.conclusion === 'success' ? '#10B981' : '#F59E0B' }}>
                  CI: {githubData.latestRun.conclusion || githubData.latestRun.status}
                </div>
              )}
            </div>

            {githubData?.prs?.length > 0 ? (
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
            )}
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(135deg, #10B981, #059669)', opacity: loading ? 0.7 : 1 }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await apiFetch('http://localhost:3001/api/git/deploy', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ directory })
                    });
                    const data = await res.json();
                    if (data.error) {
                      alert(`Deploy Error: ${data.error}\n${data.stdout || ''}`);
                    } else {
                      alert(`Deploy Success!\n\n${data.log}`);
                      fetchRepoData(); // refresh status
                    }
                  } catch (e: any) {
                    alert(`Request failed: ${e.message}`);
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
    </div>
  );
}
