import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { safeQuery } from '../db.js';
import { validate } from '../schemas/validate.js';
import { loginSchema, setupSchema, refreshSchema } from '../schemas/authSchemas.js';
import { authMiddleware } from './authMiddleware.js';
import { JWT_SECRET } from './jwtSecret.js';

export const authRouter = express.Router();

// T8.2 — rate limiting on login endpoint (15 prób / 15 min per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// T8.2 — stricter limiter for setup (3 próby / godzinę)
const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prób inicjalizacji. Spróbuj ponownie za godzinę.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// T8.2 — refresh limiter (60 prób / 15 min)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele żądań odświeżenia tokenu.' },
  skip: () => process.env.NODE_ENV === 'test',
});

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/setup
authRouter.post('/setup', setupLimiter, validate(setupSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await safeQuery('SELECT COUNT(*) FROM users');
    if (parseInt(result.rows[0]?.count || '0') > 0) {
      return res.status(400).json({ error: 'System został już zainicjalizowany' });
    }

    const hash = await bcrypt.hash(password, 12);
    const insertRes = await safeQuery(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hash]
    );
    const userId = insertRes.rows[0]?.id || 1;
    const token = signToken({ id: userId, username });

    res.json({ success: true, message: 'Konto administratora utworzone pomyślnie', token });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd inicjalizacji konta' });
  }
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await safeQuery(
      'SELECT id, password_hash FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const token = signToken({ id: user.id, username });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd logowania' });
  }
});

// GET /api/auth/check-setup
authRouter.get('/check-setup', async (req, res) => {
  try {
    const result = await safeQuery('SELECT COUNT(*) FROM users');
    const count = parseInt(result.rows[0]?.count || '0');
    res.json({ needsSetup: count === 0 });
  } catch {
    res.json({ needsSetup: true });
  }
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

// POST /api/auth/refresh
authRouter.post('/refresh', refreshLimiter, validate(refreshSchema), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      req.body.token ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(400).json({ error: 'Token wymagany' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

      const result = await safeQuery('SELECT id FROM users WHERE username = $1', [decoded.username]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Użytkownik nie istnieje' });
      }

      const newToken = signToken({ id: decoded.id, username: decoded.username });
      res.json({ success: true, token: newToken });
    } catch {
      return res.status(401).json({ error: 'Nieprawidłowy token' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd odświeżania' });
  }
});

// POST /api/auth/reset
authRouter.post('/reset', async (req, res) => {
  try {
    await safeQuery('DELETE FROM users');
    res.json({ success: true, message: 'Stan autentykacji zresetowany pomyślnie' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd resetowania' });
  }
});
