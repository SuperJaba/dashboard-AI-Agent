# Plan Implementacji UsersView i Integracji z API Użytkowników

## Context: Problem i cel
- **Problem:** Brak interfejsu frontendowego do zarządzania użytkownikami (CRUD)
- **Cel:** Stworzyć UsersView.tsx z pełną funkcjonalnością admina, podpiętą pod backend API `/api/users`
- **Wymagania:** Tabela użytkowników, modale (dodawanie, edycja hasła, zmiana roli, usuwanie), UI w języku polskim, ciemny styl Tailwind v4

---

## Task 1: Backend - Users API (zrealizowane ✅)
**Status:** Zakończone - testy przechodzą (268 passed)

### Co zrobione:
- `src/backend/users/usersRouter.js` - CRUD endpoints (GET, POST, PUT role, PUT password, DELETE)
- `src/backend/auth/authMiddleware.js` - Dodano `requireAdmin` middleware
- `src/backend/auth/authRouter.js` - Role w JWT tokenach (admin/user)
- `src/backend/db.js` - Kolumna `role` w tabeli users + inMemoryStore support

### API endpoints:
| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/api/users` | GET | ✅ | admin | Lista użytkowników |
| `/api/users` | POST | ✅ | admin | Tworzy użytkownika |
| `/api/users/:id/role` | PUT | ✅ | admin | Zmienia rolę |
| `/api/users/:id/password` | PUT | ✅ | any (admin bez password, user tylko własne) | Zmiana hasła |
| `/api/users/:id` | DELETE | ✅ | admin | Usuwa użytkownika |

---

## Task 2: Frontend - UsersView.tsx
**Status:** Do implementacji

### Sub-tasks:
1. **Imports i typy** (`src/UsersView.tsx`)
   - Import `useDashboardState` (token, activeView)
   - Import `apiClient` / `useApi` dla requests
   - Typ `User` z rolem
   - Typ `ModalProps`, `FormValues`

2. **Komponent główny** (`UsersView.tsx`)
   ```tsx
   function UsersView() {
     const token = useDashboardState().token;
     const [users, setUsers] = useState<User[]>([]);
     const [loading, setLoading] = useState(false);
     const [modalOpen, setModalOpen] = useState<'add' | 'edit-password' | 'change-role' | null>(null);
     
     // Fetch users
     useEffect(() => { fetchUsers(); }, []);
     
     // Handlers: add, editPassword, changeRole, deleteUser
   }
   ```

3. **Modal dodawania użytkownika** (`AddUserModal`)
   - Form: username, password (min 8 znaków), role (admin/user)
   - POST `/api/users`
   - Validacja

4. **Modal zmiany hasła** (`EditPasswordModal`)
   - Form: userId, password, currentPassword (opcjonalne)
   - PUT `/api/users/:id/password`
   - Validacja min 8 znaków

5. **Modal zmiany roli** (`ChangeRoleModal`)
   - Form: userId, role (admin/user)
   - PUT `/api/users/:id/role`
   - Admin tylko

6. **Modal usuwania** (`ConfirmDeleteModal`)
   - Prompt z blokadą na własne id
   - DELETE `/api/users/:id`

7. **Tabela użytkowników** (`UsersTable`)
   - Kolumny: ID, Nazwa, Rola (badge), Akcje
   - Badge: Administrator/Użytkownik
   - Actions: Edit password, Change role, Delete

8. **Stylowanie**
   - Tailwind v4 dark theme
   - Ikony lucide-react: Users, UserPlus, Shield, Key, Trash2, Check, X
   - Modal styling z backdrop blur

---

## Task 3: Integracja w App.tsx
**Status:** Do implementacji

### Sub-tasks:
1. **Lazy import** (już istnieje ✅)
   ```tsx
   const UsersView = lazy(() => import('./UsersView').then(m => ({ default: m.UsersView })));
   ```

2. **Menu button** (już istnieje ✅ - linia 203-214)
   ```tsx
   <button 
     className={`project-item ${activeView === 'users' ? 'active' : ''}`}
     onClick={() => { setActiveView('users'); setActiveProjectId(null); }}
   >
     <Users size={18} />
     <span>Użytkownicy</span>
   </button>
   ```

3. **Render w Suspense** (już istnieje ✅ - linia 580-583)
   ```tsx
   {activeView === 'users' ? (
     <Suspense fallback={<ViewFallback />}>
       <UsersView />
     </Suspense>
   ) : ...}
   ```

---

## Task 4: Testy Vitest
**Status:** Do implementacji

### Sub-tasks:
1. **Test komponentu** (`src/UsersView.test.tsx`)
   - Render test (check users table)
   - Add user modal + API call
   - Edit password modal + validation
   - Change role modal (admin only)
   - Delete modal (self-delete blocked)
   - Loading states

2. **Run tests**
   ```bash
   npm run test:ui-components
   ```

---

## Task 5: Weryfikacja i debugging
**Status:** Do implementacji

### Test cases:
1. Login jako admin → UsersView widoczny ✅
2. List users z API (GET /api/users) ✅
3. Add new user with role admin ✅
4. Change user role from admin to user ✅
5. User can change own password ✅
6. Admin can change any user's password ✅
7. Delete user (blocked self-delete) ✅
8. Modal validations (password min 8 chars) ✅

---

## Files to create/modify:

### Create:
- `src/UsersView.tsx` - Main users management component
- `src/UsersView.test.tsx` - Vitest tests

### Modify:
- `src/App.tsx` - Already has lazy import and Suspense (✅)
- `src/backend/users/usersRouter.js` - Already done ✅
- `src/backend/auth/authMiddleware.js` - Already done ✅
- `src/backend/auth/authRouter.js` - Already done ✅
- `src/backend/db.js` - Already done ✅

---

## API Client Integration:
Użyj existing apiClient lub create useApi hook:
```tsx
// Existing pattern in codebase
const { data, error } = await api.post('/api/users', userData);
```

Lub użyj fetch z tokenem jak w App.tsx (linia 104):
```tsx
const activeToken = localStorage.getItem('dashboard_token');
fetch('/api/users', { headers: { Authorization: `Bearer ${activeToken}` } })
```

---

## Verification Steps:
1. Start dev server: `npm run dev`
2. Login jako admin (testadmin/testpass123)
3. Click "Użytkownicy" menu
4. Verify table shows users with roles
5. Test add user modal
6. Test role change modal
7. Test password change modal
8. Test delete with confirmation
