import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAdmin } from '../auth/authMiddleware.js';
import { safeQuery } from '../db.js';
import { validate } from '../schemas/validate.js';

export const usersRouter = express.Router();

const createUserSchema = z.object({
  username: z.string().min(3, 'Nazwa użytkownika musi mieć min. 3 znaki').max(64),
  password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków').max(256),
  role: z.enum(['user', 'admin']).optional().default('user')
});

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin'])
});

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków').max(256),
  currentPassword: z.string().optional()
});

// GET /api/users - Lista użytkowników (wymaga admin)
usersRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await safeQuery(
      'SELECT id, username, role FROM users ORDER BY id'
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd pobierania użytkowników' });
  }
});

// POST /api/users - Tworzenie użytkownika (wymaga admin)
usersRouter.post('/', requireAdmin, validate(createUserSchema), async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;

    // Check if user exists
    const existingResult = await safeQuery(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'Nazwa użytkownika już istnieje' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 12);

    // Insert user with role
    const insertRes = await safeQuery(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, role]
    );

    res.status(201).json({
      success: true,
      message: 'Użytkownik utworzony pomyślnie',
      user: insertRes.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd tworzenia użytkownika' });
  }
});

// PUT /api/users/:id/role - Zmiana roli (wymaga admin)
usersRouter.put('/:id/role', requireAdmin, validate(updateRoleSchema), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    const result = await safeQuery(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }

    res.json({ success: true, message: `Rola użytkownika zmieniona na "${role}"`, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd zmiany roli' });
  }
});

// PUT /api/users/:id/password - Zmiana hasła
usersRouter.put('/:id/password', validate(updatePasswordSchema), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { password, currentPassword } = req.body;

    // Check permissions: admin can change any password; normal user can only change own
    if (req.user && req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Brak uprawnień do zmiany hasła innego użytkownika' });
    }

    // If current password provided, verify it
    if (currentPassword) {
      const result = await safeQuery(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Użytkownik nie istnieje' });
      }

      const user = result.rows[0];
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Nieprawidłowe obecne hasło' });
      }
    }

    // Hash new password and update
    const hash = await bcrypt.hash(password, 12);
    const result = await safeQuery(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
      [hash, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }

    res.json({ success: true, message: 'Hasło zmienione pomyślnie' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd zmiany hasła' });
  }
});

// DELETE /api/users/:id - Usunięcie użytkownika (wymaga admin)
usersRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Prevent self-deletion
    if (req.user && req.user.id === userId) {
      return res.status(403).json({ error: 'Nie można usunąć swojego konta' });
    }

    const result = await safeQuery('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }

    res.json({ success: true, message: 'Użytkownik usunięty pomyślnie' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd usuwania użytkownika' });
  }
});

export default usersRouter;
