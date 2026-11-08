// src/UsersView.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { apiFetch } from './shared/api-client';
import { useDashboardState } from './hooks/useDashboardState';
import { Modal } from './components/Modal';
import { FormField } from './components/FormField';
import { useToast } from './hooks/useToast';

/**
 * Typy danych użytkownika pochodzące z backendu.
 */
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

/**
 * Główny komponent widoku administratora użytkowników.
 * Obsługuje pobieranie listy, wyświetlanie tabeli oraz wszystkie modale CRUD.
 */
export function UsersView() {
  const { token: dashboardToken } = useDashboardState();
  const token = dashboardToken || localStorage.getItem('dashboard_token');
  const userPayload = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const currentUserId = userPayload.sub ?? userPayload.id ?? null;
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<
    | { type: 'add' }
    | { type: 'editPassword'; user: User }
    | { type: 'changeRole'; user: User }
    | { type: 'delete'; user: User }
    | null
  >(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const rawData = await apiClient.get('/api/users');
      // API may return { success: true, users: [...] } or directly an array
      const data: User[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray((rawData as any).users)
        ? (rawData as any).users
        : [];
      setUsers(data);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? 'Nie udało się pobrać listy użytkowników');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ---------- Handlery CRUD ----------
  const handleAddUser = async (values: { username: string; password: string; role: string }) => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: values.username, password: values.password, role: values.role }),
      });
      if (!res.ok) throw new Error('Add failed');
      toast.success('Użytkownik dodany');
      setModal(null);
      fetchUsers();
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się dodać użytkownika');
    }
  };

  const handleEditPassword = async (userId: number, password: string) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('Password change failed');
      toast.success('Hasło zmienione');
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się zmienić hasła');
    }
  };

  const handleChangeRole = async (userId: number, role: string) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Role change failed');
      toast.success('Rola zmieniona');
      setModal(null);
      fetchUsers();
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się zmienić roli');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Użytkownik usunięty');
      setModal(null);
      fetchUsers();
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się usunąć użytkownika');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users size={20} /> Zarządzanie Użytkownikami
        </h2>
        <button
          className="flex items-center gap-1 bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700"
          onClick={() => setModal({ type: 'add' })}
        >
          <UserPlus size={16} /> Dodaj
        </button>
      </div>
      <UsersTable users={users} loading={loading} setModal={setModal} currentUserId={currentUserId} />

      {/* ---------- Modale ---------- */}
      {modal?.type === 'add' && (
        <AddUserModal onClose={() => setModal(null)} onSubmit={handleAddUser} />
      )}
      {modal?.type === 'editPassword' && (
        <EditPasswordModal user={modal.user} onClose={() => setModal(null)} onSubmit={handleEditPassword} />
      )}
      {modal?.type === 'changeRole' && (
        <ChangeRoleModal user={modal.user} onClose={() => setModal(null)} onSubmit={handleChangeRole} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDeleteModal user={modal.user} onClose={() => setModal(null)} onConfirm={() => handleDeleteUser(modal.user.id)} />
      )}
    </div>
  );
}

/**
 * Tabela wyświetlająca listę użytkowników.
 */
function UsersTable({
  users,
  loading,
  setModal,
  currentUserId,
}: {
  users: User[];
  loading: boolean;
  setModal: React.Dispatch<React.SetStateAction<any>>;
  currentUserId: number | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray-800 text-gray-100 rounded">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-2 text-left">ID</th>
            <th className="px-4 py-2 text-left">Nazwa</th>
            <th className="px-4 py-2 text-left">Rola</th>
            <th className="px-4 py-2 text-left">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} className="px-4 py-2 text-center">
                Ładowanie...
              </td>
            </tr>
          ) : (
            users.map((u) => (
              <tr key={u.id} className="border-t border-gray-700">
                <td className="px-4 py-2">{u.id}</td>
                <td className="px-4 py-2">{u.username}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      u.role === 'admin'
                        ? 'px-2 py-1 bg-indigo-600 rounded text-xs'
                        : 'px-2 py-1 bg-gray-600 rounded text-xs'
                    }
                  >
                    {u.role === 'admin' ? 'Administrator' : 'Użytkownik'}
                  </span>
                </td>
                <td className="px-4 py-2 flex space-x-2">
                  <button
                    title="Zmień hasło"
                    className="p-1 hover:bg-gray-700 rounded"
                    onClick={() => setModal({ type: 'editPassword', user: u })}
                  >
                    <Key size={16} />
                  </button>
                  <button
                    title="Zmień rolę"
                    className="p-1 hover:bg-gray-700 rounded"
                    onClick={() => setModal({ type: 'changeRole', user: u })}
                  >
                    <Shield size={16} />
                  </button>
                  <button
                    title="Usuń"
                    className="p-1 hover:bg-gray-700 rounded"
                    onClick={() => setModal({ type: 'delete', user: u })}
                    disabled={u.id === currentUserId}
                  >
                    <Trash2 size={16} className={u.id === currentUserId ? 'opacity-40' : ''} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Modal dodawania nowego użytkownika.
 */
function AddUserModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: any) => void }) {
  const [values, setValues] = useState({ username: '', password: '', role: 'user' });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (values.password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków');
      return;
    }
    setError('');
    onSubmit(values);
  };

  return (
    <Modal title="Dodaj użytkownika" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nazwa użytkownika" name="username" value={values.username} onChange={handleChange} required />
        <FormField label="Hasło" name="password" type="password" value={values.password} onChange={handleChange} required />
        <FormField as="select" label="Rola" name="role" value={values.role} onChange={handleChange} required>
          <option value="admin">Administrator</option>
          <option value="user">Użytkownik</option>
        </FormField>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end space-x-2">
          <button type="button" className="px-3 py-1" onClick={onClose}>
            <X size={16} /> Anuluj
          </button>
          <button type="submit" className="px-3 py-1 bg-primary-600 text-white rounded flex items-center gap-1">
            <Check size={16} /> Dodaj
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Modal zmiany hasła użytkownika.
 */
function EditPasswordModal({ user, onClose, onSubmit }: { user: User; onClose: () => void; onSubmit: (id: number, pw: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków');
      return;
    }
    setError('');
    onSubmit(user.id, password);
  };

  return (
    <Modal title={`Zmień hasło – ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nowe hasło" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end space-x-2">
          <button type="button" className="px-3 py-1" onClick={onClose}>
            <X size={16} /> Anuluj
          </button>
          <button type="submit" className="px-3 py-1 bg-primary-600 text-white rounded flex items-center gap-1">
            <Check size={16} /> Zapisz
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Modal zmiany roli użytkownika.
 */
function ChangeRoleModal({ user, onClose, onSubmit }: { user: User; onClose: () => void; onSubmit: (id: number, role: string) => void }) {
  const [role, setRole] = useState(user.role);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(user.id, role);
  };

  return (
    <Modal title={`Zmień rolę – ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField as="select" label="Rola" name="role" value={role} onChange={(e) => setRole(e.target.value as any)} required>
          <option value="admin">Administrator</option>
          <option value="user">Użytkownik</option>
        </FormField>
        <div className="flex justify-end space-x-2">
          <button type="button" className="px-3 py-1" onClick={onClose}>
            <X size={16} /> Anuluj
          </button>
          <button type="submit" className="px-3 py-1 bg-primary-600 text-white rounded flex items-center gap-1">
            <Check size={16} /> Zapisz
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Modal potwierdzenia usunięcia użytkownika.
 */
function ConfirmDeleteModal({ user, onClose, onConfirm }: { user: User; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal title="Potwierdź usunięcie" onClose={onClose}>
      <p>Czy napewno chcesz usunąć użytkownika <strong>{user.username}</strong>?</p>
      <div className="flex justify-end space-x-2 mt-4">
        <button type="button" className="px-3 py-1" onClick={onClose}>
          <X size={16} /> Anuluj
        </button>
        <button type="button" className="px-3 py-1 bg-red-600 text-white rounded flex items-center gap-1" onClick={onConfirm}>
          <Trash2 size={16} /> Usuń
        </button>
      </div>
    </Modal>
  );
}

// Export individual components for potential testing
export { UsersTable, AddUserModal, EditPasswordModal, ChangeRoleModal, ConfirmDeleteModal };
