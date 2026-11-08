import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './hooks/useToast';
import { Badge } from './components/Badge';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  ShieldCheck,
  Key, 
  Trash2, 
  RefreshCw, 
  X, 
  AlertCircle,
  Eye, 
  EyeOff,
  Search,
  LayoutGrid,
  List,
  UserCheck,
  Crown,
  Lock
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
  const toast = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtrowanie i widok
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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

  // Statystyki
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const regular = users.filter(u => u.role === 'user').length;
    return { total, admins, regular };
  }, [users]);

  // Filtrowana lista użytkowników
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(u.id).includes(searchQuery.trim());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

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
      toast.success('Użytkownik został pomyślnie utworzony.');
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
      toast.success(`Zmieniono rolę dla ${user.username} na ${newTargetRole === 'admin' ? 'Administrator' : 'Użytkownik'}.`);
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
      toast.success(`Hasło użytkownika ${passwordTargetUser.username} zostało zaktualizowane.`);
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
      toast.success(`Użytkownik ${deleteTargetUser.username} został usunięty.`);
      await fetchUsers();
    } catch (err: any) {
      setDeleteError(err?.message || 'Błąd podczas usuwania użytkownika');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '2rem' }} className="space-y-6">
      {/* Nagłówek główny */}
      <header className="header animate-in flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Users size={24} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white m-0">
                  Zarządzanie Użytkownikami
                </h1>
                <Badge variant="primary" size="sm">
                  {users.length} {users.length === 1 ? 'konto' : users.length < 5 ? 'konta' : 'kont'}
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mt-1 mb-0">
                Centralne zarządzanie dostępem, uprawnieniami ról i bezpieczeństwem kont w systemie
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="btn btn-secondary px-3.5 py-2.5 flex items-center gap-2 text-sm font-medium"
            title="Odśwież listę"
            aria-label="Odśwież listę"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" />
            <span>Odśwież</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="btn btn-primary px-4 py-2.5 flex items-center gap-2 text-sm font-medium shadow-lg shadow-indigo-500/20"
            aria-label="Dodaj użytkownika"
          >
            <UserPlus size={18} aria-hidden="true" />
            <span>Dodaj użytkownika</span>
          </button>
        </div>
      </header>

      {/* Komunikat błędu */}
      {error && (
        <div 
          role="alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 animate-in"
        >
          <AlertCircle size={20} className="flex-none text-rose-400" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Karty podsumowania / KPI — Wykorzystanie przestrzeni ekranu */}
      <section aria-label="Statystyki użytkowników" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in delay-1">
        <div className="glass-card p-4 rounded-xl border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 flex-none">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Wszyscy użytkownicy</div>
            <div className="text-2xl font-bold text-white mt-0.5">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-0.5">Zarejestrowane konta</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/[0.08] hover:border-purple-500/30 transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 flex-none">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Administratorzy</div>
            <div className="text-2xl font-bold text-purple-300 mt-0.5">{stats.admins}</div>
            <div className="text-xs text-purple-400/70 mt-0.5">Pełne uprawnienia systemu</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/[0.08] hover:border-sky-500/30 transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 flex-none">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Użytkownicy standardowi</div>
            <div className="text-2xl font-bold text-sky-300 mt-0.5">{stats.regular}</div>
            <div className="text-xs text-sky-400/70 mt-0.5">Dostęp podstawowy</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/[0.08] hover:border-emerald-500/30 transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-none">
            <Crown size={24} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Twoja sesja</div>
            <div className="text-base font-bold text-emerald-300 truncate mt-0.5">
              {currentUser?.username ? `Konto: ${currentUser.username}` : 'Zalogowano'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sesja aktywna</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pasek narzędziowy: Wyszukiwanie, Filtry i Przełącznik widoku */}
      <div className="glass-card p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in delay-2">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Input wyszukiwania */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj użytkownika po nazwie lub ID..."
              className="input-field w-full pl-9 pr-8 py-2 text-sm bg-slate-900/50 border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Wyczyść szukanie"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtry roli */}
          <div className="flex items-center gap-1 bg-slate-900/40 p-1 rounded-lg border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                roleFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wszyscy ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                roleFilter === 'admin'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Administratorzy ({stats.admins})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('user')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                roleFilter === 'user'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Użytkownicy ({stats.regular})
            </button>
          </div>
        </div>

        {/* Przełącznik widoku: Karty vs Tabela */}
        <div className="flex items-center gap-1 bg-slate-900/40 p-1 rounded-lg border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Widok kafelków"
            aria-label="Widok kafelków"
            className={`p-2 rounded-md transition-all ${
              viewMode === 'grid' 
                ? 'bg-white/[0.12] text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            title="Widok tabeli"
            aria-label="Widok tabeli"
            className={`p-2 rounded-md transition-all ${
              viewMode === 'table' 
                ? 'bg-white/[0.12] text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Główny obszar rekordów */}
      <main className="animate-in delay-3">
        {loading && users.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-2xl border border-white/[0.08]">
            <RefreshCw size={36} className="spin mx-auto text-indigo-400 mb-4" />
            <div className="text-base font-medium text-white">Ładowanie listy użytkowników...</div>
            <div className="text-sm text-slate-400 mt-1">Pobieranie uprawnień i kont systemowych</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-2xl border border-white/[0.08]">
            <Users size={40} className="mx-auto text-slate-500 mb-3" />
            <div className="text-base font-semibold text-white">
              {searchQuery || roleFilter !== 'all' ? 'Brak wyników wyszukiwania' : 'Brak zarejestrowanych użytkowników'}
            </div>
            <div className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || roleFilter !== 'all' 
                ? 'Spróbuj zmienić kryteria filtrowania lub wyczyścić frazę wyszukiwania.'
                : 'Nie znaleziono kont użytkowników w bazie. Użyj przycisku powyżej, aby utworzyć nowe konto.'}
            </div>
            {(searchQuery || roleFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
                className="btn btn-secondary mt-4 text-xs font-medium px-3 py-1.5"
              >
                Resetuj filtry
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* =========================================================================
             WIDOK KAFELKÓW / KART (Duże, przejrzyste rekordy zagospodarowujące przestrzeń)
             ========================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredUsers.map(u => {
              const isCurrent = currentUser?.id === u.id || currentUser?.username === u.username;
              const isAdmin = u.role === 'admin';

              return (
                <div
                  key={u.id}
                  className={`glass-card p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative group ${
                    isCurrent 
                      ? 'border-indigo-500/50 bg-indigo-950/20 shadow-lg shadow-indigo-500/10' 
                      : 'border-white/[0.08] hover:border-white/[0.18] hover:bg-slate-900/60'
                  }`}
                >
                  {/* Nagłówek karty usera */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Avatar z inicjałem */}
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          <div 
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-md border ${
                              isAdmin
                                ? 'bg-gradient-to-br from-purple-500/30 to-indigo-600/20 text-purple-300 border-purple-500/40'
                                : 'bg-gradient-to-br from-sky-500/30 to-blue-600/20 text-sky-300 border-sky-500/40'
                            }`}
                          >
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          {isAdmin && (
                            <div 
                              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center shadow-sm"
                              title="Administrator"
                            >
                              <Shield size={12} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                              {u.username}
                            </span>
                            {isCurrent && (
                              <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                Ty
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            ID: #{u.id}
                          </div>
                        </div>
                      </div>

                      {/* Badge roli */}
                      <Badge
                        variant={isAdmin ? 'primary' : 'neutral'}
                        icon={isAdmin ? <Shield size={12} /> : undefined}
                      >
                        {isAdmin ? 'Administrator' : 'Użytkownik'}
                      </Badge>
                    </div>

                    {/* Szczegóły roli & opis uprawnień */}
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-white/[0.04] mb-4 text-xs text-slate-300 space-y-2">
                      <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-white/[0.04]">
                        <span className="flex items-center gap-1.5">
                          <Lock size={12} />
                          <span>Poziom dostępu</span>
                        </span>
                        <span className="font-semibold text-slate-200">
                          {isAdmin ? 'Pełne uprawnienia' : 'Standardowy'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 m-0 leading-relaxed">
                        {isAdmin
                          ? 'Dostęp do zarządzania użytkownikami, konfiguracji systemowej, bazy danych oraz terminali.'
                          : 'Dostęp operacyjny do dashboardu, metryk monitoringowych oraz przypisanych widgetów.'}
                      </p>

                      {/* Selektor szybkiej zmiany roli */}
                      {!isCurrent && (
                        <div className="pt-2 flex items-center justify-between gap-2">
                          <label htmlFor={`role-select-${u.id}`} className="text-[11px] font-medium text-slate-400">
                            Zmień uprawnienia:
                          </label>
                          <select
                            id={`role-select-${u.id}`}
                            value={u.role}
                            onChange={(e) => handleChangeRole(u, e.target.value as 'admin' | 'user')}
                            className="bg-slate-900 border border-white/[0.12] text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                            title="Zmień rolę"
                            aria-label={`Zmień rolę dla ${u.username}`}
                          >
                            <option value="user">Użytkownik</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dolna belka akcji na karcie */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordTargetUser(u);
                        setChangePasswordVal('');
                        setPasswordError(null);
                      }}
                      className="btn btn-secondary flex-1 py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 rounded-lg hover:border-indigo-500/40"
                      title="Zmień hasło"
                      aria-label={`Zmień hasło dla ${u.username}`}
                    >
                      <Key size={14} className="text-indigo-400" aria-hidden="true" />
                      <span>Hasło</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        setDeleteTargetUser(u);
                        setDeleteError(null);
                      }}
                      className={`btn btn-secondary py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 rounded-lg transition-all ${
                        isCurrent 
                          ? 'opacity-40 cursor-not-allowed text-slate-500' 
                          : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30'
                      }`}
                      title={isCurrent ? 'Nie możesz usunąć własnego konta' : 'Usuń użytkownika'}
                      aria-label={`Usuń użytkownika ${u.username}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Usuń</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* =========================================================================
             WIDOK TABELI (Przestronna, zoptymalizowana tabela na pełną szerokość)
             ========================================================================= */
          <div className="glass-card rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="responsive-table w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6 w-20">ID</th>
                    <th className="py-4 px-6">Użytkownik</th>
                    <th className="py-4 px-6">Rola w systemie</th>
                    <th className="py-4 px-6">Szybka zmiana roli</th>
                    <th className="py-4 px-6 text-right">Akcje administracyjne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredUsers.map(u => {
                    const isCurrent = currentUser?.id === u.id || currentUser?.username === u.username;
                    const isAdmin = u.role === 'admin';

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          isCurrent ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-4 px-6 text-sm font-mono text-slate-400">
                          #{u.id}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <div 
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base border ${
                                isAdmin
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                              }`}
                            >
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-sm">
                                  {u.username}
                                </span>
                                {isCurrent && (
                                  <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                    Ty
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {isAdmin ? 'Uprawnienia administratora' : 'Konto standardowe'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <Badge
                            variant={isAdmin ? 'primary' : 'neutral'}
                            icon={isAdmin ? <Shield size={12} /> : undefined}
                          >
                            {isAdmin ? 'Administrator' : 'Użytkownik'}
                          </Badge>
                        </td>
                        <td className="py-4 px-6">
                          {!isCurrent ? (
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeRole(u, e.target.value as 'admin' | 'user')}
                              className="bg-slate-900/80 border border-white/[0.12] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                              title="Zmień rolę"
                              aria-label={`Zmień rolę dla ${u.username}`}
                            >
                              <option value="user">Użytkownik</option>
                              <option value="admin">Administrator</option>
                            </select>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Bieżąca sesja</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordTargetUser(u);
                                setChangePasswordVal('');
                                setPasswordError(null);
                              }}
                              className="btn btn-secondary px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-lg"
                              title="Zmień hasło"
                              aria-label={`Zmień hasło dla ${u.username}`}
                            >
                              <Key size={14} className="text-indigo-400" aria-hidden="true" />
                              <span>Hasło</span>
                            </button>
                            <button
                              type="button"
                              disabled={isCurrent}
                              onClick={() => {
                                setDeleteTargetUser(u);
                                setDeleteError(null);
                              }}
                              className={`btn btn-secondary px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-lg transition-all ${
                                isCurrent 
                                  ? 'opacity-40 cursor-not-allowed text-slate-500' 
                                  : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30'
                              }`}
                              title={isCurrent ? 'Nie możesz usunąć własnego konta' : 'Usuń użytkownika'}
                              aria-label={`Usuń użytkownika ${u.username}`}
                            >
                              <Trash2 size={14} aria-hidden="true" />
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
          </div>
        )}
      </main>

      {/* =========================================================================
         MODALE: Zachowane atrybuty dostępności, formularze i akcje
         ========================================================================= */}

      {/* Modal: Dodawanie użytkownika */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-modal-title"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in"
        >
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/[0.12] shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <UserPlus size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 id="add-user-modal-title" className="text-lg font-bold text-white m-0">
                    Nowy użytkownik
                  </h2>
                  <p className="text-xs text-slate-400 m-0">Utwórz nowe konto dostępu do systemu</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Zamknij"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {addError && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-none text-rose-400" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label htmlFor="new-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nazwa użytkownika (login)
                </label>
                <input
                  id="new-username"
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="np. jan_kowalski"
                  className="input-field w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900/60 border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Hasło (min. 8 znaków)
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl bg-slate-900/60 border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="new-role" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Rola w systemie
                </label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                  className="input-field w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-white/[0.1] text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="user">Użytkownik (standardowy dostęp)</option>
                  <option value="admin">Administrator (pełne uprawnienia)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary px-4 py-2 text-xs font-medium rounded-xl"
                  disabled={addLoading}
                  aria-label="Anuluj"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="btn btn-primary px-5 py-2 text-xs font-medium rounded-xl shadow-lg shadow-indigo-500/20"
                  aria-label="Utwórz konto"
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-modal-title"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in"
        >
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/[0.12] shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Key size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 id="change-password-modal-title" className="text-base font-bold text-white m-0 truncate max-w-[260px]">
                    Zmiana hasła: {passwordTargetUser.username}
                  </h2>
                  <p className="text-xs text-slate-400 m-0">Wprowadź nowe hasło logowania</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Zamknij"
                onClick={() => setPasswordTargetUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {passwordError && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-none text-rose-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="change-password-val" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nowe hasło (min. 8 znaków)
                </label>
                <div className="relative">
                  <input
                    id="change-password-val"
                    type={showChangePassword ? 'text' : 'password'}
                    required
                    value={changePasswordVal}
                    onChange={(e) => setChangePasswordVal(e.target.value)}
                    placeholder="••••••••"
                    className="input-field w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl bg-slate-900/60 border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showChangePassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showChangePassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  className="btn btn-secondary px-4 py-2 text-xs font-medium rounded-xl"
                  disabled={passwordLoading}
                  aria-label="Anuluj"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn btn-primary px-5 py-2 text-xs font-medium rounded-xl shadow-lg shadow-indigo-500/20"
                  aria-label="Zmień hasło"
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-modal-title"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in"
        >
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-rose-500/30 shadow-2xl">
            <div className="flex items-center gap-3.5 mb-4 text-rose-400">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-none">
                <ShieldAlert size={26} aria-hidden="true" />
              </div>
              <div>
                <h2 id="delete-user-modal-title" className="text-lg font-bold text-white m-0">
                  Usuń użytkownika
                </h2>
                <p className="text-xs text-rose-300/80 m-0">Potwierdzenie nieodwracalnej operacji</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-5 leading-relaxed">
              Czy na pewno chcesz bezpowrotnie usunąć konto użytkownika <strong className="text-white font-semibold">{deleteTargetUser.username}</strong>?
              Użytkownik natychmiast utraci dostęp do systemu i wszystkich powiązanych zasobów.
            </p>

            {deleteError && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="btn btn-secondary px-4 py-2 text-xs font-medium rounded-xl"
                disabled={deleteLoading}
                aria-label="Anuluj"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="btn btn-danger px-5 py-2 text-xs font-medium rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                aria-label="Usuń konto"
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
