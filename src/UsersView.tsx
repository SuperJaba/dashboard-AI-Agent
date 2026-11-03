import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  Key, 
  Trash2, 
  RefreshCw, 
  Check, 
  X, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiClient } from './shared/api-client';

export interface UserItem {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at?: string;
}

function parseJwtUser(): { id?: number; username?: string; role?: string } | null {
  try {
    const token = localStorage.getItem('dashboard_token');
    if (!token) return null;
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function UsersView() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Aktualny zalogowany użytkownik
  const currentUser = parseJwtUser();

  // Modal: Dodawanie użytkownika
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal: Zmiana hasła
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserItem | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Modal: Usuwanie użytkownika
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ success: boolean; users: UserItem[] }>('/api/users');
      if (data && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Nie udało się pobrać listy użytkowników');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || newPassword.length < 8) {
      setAddError('Nazwa min. 3 znaki, hasło min. 8 znaków.');
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      await apiClient.post('/api/users', {
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      setShowAddModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setActionSuccess('Użytkownik został pomyślnie utworzony.');
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      setAddError(err?.message || 'Błąd podczas tworzenia użytkownika');
    } finally {
      setAddLoading(false);
    }
  };

  const handleChangeRole = async (user: UserItem, newTargetRole: 'admin' | 'user') => {
    if (user.role === newTargetRole) return;
    try {
      await apiClient.put(`/api/users/${user.id}/role`, { role: newTargetRole });
      setActionSuccess(`Zmieniono rolę dla ${user.username} na ${newTargetRole === 'admin' ? 'Administrator' : 'Użytkownik'}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Błąd podczas zmiany roli użytkownika');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser || changePasswordVal.length < 8) {
      setPasswordError('Nowe hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      await apiClient.put(`/api/users/${passwordTargetUser.id}/password`, {
        password: changePasswordVal,
      });
      setPasswordTargetUser(null);
      setChangePasswordVal('');
      setActionSuccess(`Hasło użytkownika ${passwordTargetUser.username} zostało zaktualizowane.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Błąd podczas zmiany hasła');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/users/${deleteTargetUser.id}`);
      setDeleteTargetUser(null);
      setActionSuccess(`Użytkownik ${deleteTargetUser.username} został usunięty.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      setDeleteError(err?.message || 'Błąd podczas usuwania użytkownika');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1.5rem' }}>
      {/* Nagłówek */}
      <header className="header animate-in" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            <Users size={28} color="var(--primary)" aria-hidden="true" />
            Zarządzanie Użytkownikami
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Uprawnienia, role kont oraz bezpieczeństwo dostępu do Dashboardu
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="btn btn-secondary"
            title="Odśwież listę"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Odśwież</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)' }}
          >
            <UserPlus size={16} />
            <span>Dodaj użytkownika</span>
          </button>
        </div>
      </header>

      {/* Komunikaty akcji */}
      {actionSuccess && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          borderRadius: '8px',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Check size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela użytkowników */}
      <div className="glass-card animate-in delay-1" style={{ padding: '1rem' }}>
        {loading && users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Ładowanie listy użytkowników...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Brak zarejestrowanych użytkowników.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Użytkownik</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Rola</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isCurrent = currentUser?.id === u.id || currentUser?.username === u.username;
                  return (
                    <tr 
                      key={u.id}
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        backgroundColor: isCurrent ? 'rgba(168, 85, 247, 0.04)' : undefined
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        #{u.id}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                            color: u.role === 'admin' ? '#c084fc' : '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                          }}>
                            {u.username.charAt(0).toUpperCase()}
                          </span>
                          <span>{u.username}</span>
                          {isCurrent && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              Ty
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            backgroundColor: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                            color: u.role === 'admin' ? '#c084fc' : '#94a3b8',
                            border: `1px solid ${u.role === 'admin' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`
                          }}>
                            {u.role === 'admin' ? <Shield size={12} /> : null}
                            {u.role === 'admin' ? 'Administrator' : 'Użytkownik'}
                          </span>

                          {/* Szybka zmiana roli */}
                          {!isCurrent && (
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeRole(u, e.target.value as 'admin' | 'user')}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                borderRadius: '4px',
                                padding: '0.1rem 0.3rem'
                              }}
                              title="Zmień rolę"
                            >
                              <option value="user" style={{ background: '#1e293b', color: '#fff' }}>Użytkownik</option>
                              <option value="admin" style={{ background: '#1e293b', color: '#fff' }}>Administrator</option>
                            </select>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordTargetUser(u);
                              setChangePasswordVal('');
                              setPasswordError(null);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Zmień hasło"
                          >
                            <Key size={14} />
                            <span>Hasło</span>
                          </button>
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => {
                              setDeleteTargetUser(u);
                              setDeleteError(null);
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.8rem',
                              color: isCurrent ? 'var(--text-muted)' : '#ef4444',
                              opacity: isCurrent ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title={isCurrent ? 'Nie możesz usunąć własnego konta' : 'Usuń użytkownika'}
                          >
                            <Trash2 size={14} />
                            <span>Usuń</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Dodawanie użytkownika */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} color="var(--primary)" />
                Nowy użytkownik
              </h2>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {addError && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.85rem' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Nazwa użytkownika (login)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="np. jan_kowalski"
                  className="input-field"
                  style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Hasło (min. 8 znaków)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field"
                    style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Rola w systemie
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                  className="input-field"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: '#0f172a' }}
                >
                  <option value="user">Użytkownik (standardowy dostęp)</option>
                  <option value="admin">Administrator (pełne uprawnienia)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  disabled={addLoading}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="btn btn-primary"
                  style={{ background: 'var(--primary)' }}
                >
                  {addLoading ? 'Zapisywanie...' : 'Utwórz konto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Zmiana hasła */}
      {passwordTargetUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} color="var(--primary)" />
                Zmiana hasła: {passwordTargetUser.username}
              </h2>
              <button 
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {passwordError && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.85rem' }}>
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Nowe hasło (min. 8 znaków)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showChangePassword ? 'text' : 'password'}
                    required
                    value={changePasswordVal}
                    onChange={(e) => setChangePasswordVal(e.target.value)}
                    placeholder="••••••••"
                    className="input-field"
                    style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showChangePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  className="btn btn-secondary"
                  disabled={passwordLoading}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn btn-primary"
                  style={{ background: 'var(--primary)' }}
                >
                  {passwordLoading ? 'Zapisywanie...' : 'Zmień hasło'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Potwierdzenie usunięcia */}
      {deleteTargetUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#ef4444' }}>
              <ShieldAlert size={28} />
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Usuń użytkownika</h2>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Czy na pewno chcesz bezpowrotnie usunąć konto użytkownika <strong>{deleteTargetUser.username}</strong>?
            </p>

            {deleteError && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.85rem' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="btn btn-secondary"
                disabled={deleteLoading}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="btn btn-danger"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                {deleteLoading ? 'Usuwanie...' : 'Usuń konto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersView;
