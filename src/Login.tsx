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

    // Listen for global 401 unauthorized events to immediately reset auth state
    const handleUnauthorized = () => {
      localStorage.removeItem('dashboard_token');
      setIsAuthenticated(false);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const initialToken = localStorage.getItem('dashboard_token');
    if (initialToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${initialToken}` }
      })
        .then(res => {
          if (!active) return;
          if (!res.ok) {
            handleUnauthorized();
          }
        })
        .catch(() => {});
    }

    const checkSetup = () => {
      fetch('/api/auth/check-setup')
        .then(res => res.json())
        .then(data => {
          if (!active) return;
          if (data.needsSetup) {
            handleUnauthorized();
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
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = needsSetup ? '/api/auth/setup' : '/api/auth/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        localStorage.setItem('dashboard_token', data.token);
        setIsAuthenticated(true);
        window.location.reload();
      } else if (needsSetup) {
        setNeedsSetup(false);
        setError('Inicjalizacja zakończona. Zaloguj się podanymi danymi.');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div 
        style={{ 
          minHeight: '100vh', 
          backgroundColor: '#0f172a', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#94a3b8',
          fontFamily: 'Inter, sans-serif' 
        }} 
        role="status" 
        aria-live="polite"
      >
        Ładowanie systemu...
      </div>
    );
  }

  return (
    <div 
      style={{ 
        minHeight: '100vh', 
        width: '100vw',
        backgroundColor: '#0f172a', 
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.25) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.2) 0px, transparent 50%)
        `,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '1.5rem',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background ambient glow circles */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'rgba(79, 70, 229, 0.15)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          pointerEvents: 'none'
        }}
      />

      <div 
        style={{ 
          width: '100%', 
          maxWidth: '420px', 
          margin: '0 auto', 
          position: 'relative', 
          zIndex: 1 
        }}
      >
        <div 
          className="glass-card animate-in"
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(79, 70, 229, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: 'rgba(79, 70, 229, 0.2)', 
                border: '1px solid rgba(79, 70, 229, 0.5)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#818cf8',
                marginBottom: '1rem',
                boxShadow: '0 0 24px rgba(79, 70, 229, 0.35)'
              }}
            >
              {needsSetup ? <ShieldCheck size={32} aria-hidden="true" /> : <Lock size={32} aria-hidden="true" />}
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              {needsSetup ? 'Inicjalizacja Systemu' : 'Logowanie'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem', marginBottom: 0, lineHeight: 1.4 }}>
              {needsSetup 
                ? 'Witaj. Utwórz pierwsze konto administratora, aby zabezpieczyć swój panel.' 
                : 'Wprowadź swoje dane dostępowe, aby przejść do centrum dowodzenia.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="login-username" className="info-label" style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                Nazwa użytkownika
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '1rem', color: '#64748b', display: 'flex', pointerEvents: 'none' }}>
                  <User size={18} aria-hidden="true" />
                </div>
                <input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="login-password" className="info-label" style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                Hasło
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '1rem', color: '#64748b', display: 'flex', pointerEvents: 'none' }}>
                  <Key size={18} aria-hidden="true" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                />
              </div>
            </div>

            {error && (
              <div 
                role="alert" 
                aria-live="assertive" 
                style={{ 
                  padding: '0.75rem 1rem', 
                  backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                  borderRadius: '12px', 
                  color: '#f87171', 
                  fontSize: '0.85rem', 
                  textAlign: 'center',
                  lineHeight: 1.4 
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                marginTop: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <span>{needsSetup ? 'Utwórz konto admina' : 'Zaloguj się'}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

