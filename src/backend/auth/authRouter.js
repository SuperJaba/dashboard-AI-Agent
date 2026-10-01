import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { safeQuery } from '../db.js';

export const authRouter = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-123';

authRouter.post('/setup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {return res.status(400).json({ error: 'Nazwa użytkownika i hasło są wymagane' });}
    
    // Check if any user exists
    const result = await safeQuery('SELECT COUNT(*) FROM users');
    if (parseInt(result.rows[0]?.count || '0') > 0) {
      return res.status(400).json({ error: 'System został już zainicjalizowany' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    const insertRes = await safeQuery('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
    const userId = insertRes.rows[0]?.id || 1;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, message: 'Konto administratora utworzone pomyślnie', token });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd inicjalizacji konta' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {return res.status(400).json({ error: 'Nazwa użytkownika i hasło są wymagane' });}

    const result = await safeQuery('SELECT id, password_hash FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd logowania' });
  }
});

authRouter.get('/check-setup', async (req, res) => {
  try {
    const result = await safeQuery('SELECT COUNT(*) FROM users');
    const count = parseInt(result.rows[0]?.count || '0');
    res.json({ needsSetup: count === 0 });
  } catch  {
    res.json({ needsSetup: true });
  }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.body.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
    
    if (!token) {return res.status(400).json({ error: 'Token required' });}

    try {
      const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      
      const result = await safeQuery('SELECT id FROM users WHERE username = $1', [decoded.username]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User no longer exists' });
      }

      const newToken = jwt.sign({ id: decoded.id, username: decoded.username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token: newToken });
    } catch  {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd odświeżania' });
  }
});

authRouter.post('/reset', async (req, res) => {
  try {
    await safeQuery('DELETE FROM users');
    res.json({ success: true, message: 'Stan autentykacji zresetowany pomyślnie' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd resetowania' });
  }
});
