import { useState, useEffect } from 'react';
import { Lock, User, Key, ChevronRight, ShieldCheck } from 'lucide-react';
import './index.css';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('dashboard_token'));
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let retryTimeout: any;

    const checkSetup = () => {
      fetch('http://localhost:3001/api/auth/check-setup')
        .then(res => res.json())
        .then(data => {
          if (!active) return;
          if (data.needsSetup) {
            setNeedsSetup(true);
          }
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          // Silent warning instead of console error, retry in 1s
          retryTimeout = setTimeout(checkSetup, 1000);
        });
    };

    checkSetup();

    return () => {
      active = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = needsSetup ? '/api/auth/setup' : '/api/auth/login';
    
    try {
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (needsSetup) {
        // Automatically log in after setup, or just switch to login mode
        setNeedsSetup(false);
        setError('Setup complete. Please log in.');
        setPassword('');
      } else {
        localStorage.setItem('dashboard_token', data.token);
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="relative w-full max-w-md animate-in delay-1">
        <div className="glass-card">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4 ring-1 ring-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
              {needsSetup ? <ShieldCheck size={32} /> : <Lock size={32} />}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {needsSetup ? 'System Setup' : 'Dashboard Login'}
            </h1>
            <p className="text-gray-400 text-sm mt-2 text-center">
              {needsSetup 
                ? 'Welcome. Please create the initial admin account to secure your dashboard.' 
                : 'Enter your credentials to access the command center.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="info-label ml-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="info-label ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Key size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full mt-4"
            >
              <span>{needsSetup ? 'Initialize System' : 'Authenticate'}</span>
              <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
