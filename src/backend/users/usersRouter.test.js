import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { usersRouter } from './usersRouter.js';
import { authMiddleware } from '../auth/authMiddleware.js';
import { JWT_SECRET } from '../auth/jwtSecret.js';
import { safeQuery } from '../db.js';

describe('Users Router (/api/users)', () => {
  let app;
  let adminToken;
  let userToken;
  let adminId;
  let regularUserId;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/users', authMiddleware, usersRouter);

    // Czyszczenie i przygotowanie testowych użytkowników
    await safeQuery("DELETE FROM users WHERE username IN ('admin_user', 'regular_user', 'nowy_admin', 'nowy_user')");

    const adminHash = await bcrypt.hash('adminpassword123', 12);
    const adminRes = await safeQuery(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      ['admin_user', adminHash, 'admin']
    );
    adminId = adminRes.rows[0].id;
    adminToken = jwt.sign({ id: adminId, username: 'admin_user', role: 'admin' }, JWT_SECRET);

    const userHash = await bcrypt.hash('userpassword123', 12);
    const userRes = await safeQuery(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      ['regular_user', userHash, 'user']
    );
    regularUserId = userRes.rows[0].id;
    userToken = jwt.sign({ id: regularUserId, username: 'regular_user', role: 'user' }, JWT_SECRET);
  });

  afterEach(async () => {
    await safeQuery("DELETE FROM users WHERE username IN ('admin_user', 'regular_user', 'nowy_admin', 'nowy_user')");
  });

  describe('GET /api/users', () => {
    it('zwraca 401 bez nagłówka Authorization', async () => {
      const res = await request(app).get('/api/users');
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('zwraca 403 dla użytkownika z rolą user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('administratora');
    });

    it('zwraca listę użytkowników dla admina', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThanOrEqual(2);
      expect(res.body.users.some(u => u.username === 'admin_user')).toBe(true);
      expect(res.body.users.some(u => u.username === 'regular_user')).toBe(true);
    });
  });

  describe('POST /api/users', () => {
    it('zwraca 403 dla roli user przy próbie dodania użytkownika', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ username: 'nowy_user', password: 'password123', role: 'user' });
      expect(res.statusCode).toBe(403);
    });

    it('tworzy nowego użytkownika gdy wywołuje admin', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'nowy_admin', password: 'securepassword123', role: 'admin' });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('nowy_admin');
      expect(res.body.user.role).toBe('admin');
    });

    it('odrzuca zbyt krótkie hasło (min 8 znaków)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'krotkie_haslo', password: '123' });
      expect(res.statusCode).toBe(400);
    });

    it('odrzuca zduplikowaną nazwę użytkownika', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'admin_user', password: 'password123', role: 'user' });
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('już istnieje');
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('zmienia rolę użytkownika na admin', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('admin');
    });

    it('odrzuca nieprawidłową wartość roli', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'supergod' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/users/:id/password', () => {
    it('pozwala adminowi zmienić hasło innego użytkownika bez obecnego hasła', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'brandnewpassword123' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('blokuje zwykłemu użytkownikowi zmianę hasła kogoś innego', async () => {
      const res = await request(app)
        .put(`/api/users/${adminId}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'hackedpassword123' });
      expect(res.statusCode).toBe(403);
    });

    it('pozwala zwykłemu użytkownikowi zmienić własne hasło', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'newuserpassword123' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('blokuje usunięcie samego siebie przez admina', async () => {
      const res = await request(app)
        .delete(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('swojego konta');
    });

    it('pozwala adminowi usunąć innego użytkownika', async () => {
      const res = await request(app)
        .delete(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
