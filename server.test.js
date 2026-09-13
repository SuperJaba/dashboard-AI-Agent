import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './server.js';

vi.mock('child_process', async (importOriginal) => {
  const mod = await importOriginal();
  const mockedExec = vi.fn((cmd, cb) => cb(null, '/mocked/path\n', ''));
  const mockedExecFile = vi.fn((file, args, cb) => cb(null, '/mocked/path\n', ''));
  const mockedSpawn = vi.fn(() => ({ unref: vi.fn() }));
  return {
    ...mod,
    exec: mockedExec,
    execFile: mockedExecFile,
    spawn: mockedSpawn,
    default: {
      ...mod.default,
      exec: mockedExec,
      execFile: mockedExecFile,
      spawn: mockedSpawn
    }
  };
});

// Mock pg to prevent real db connections during tests
vi.mock('pg', () => {
  const mPool = {
    query: vi.fn().mockResolvedValue({ rows: [] })
  };
  class Pool {
    constructor() { return mPool; }
  }
  return { default: { Pool } };
});

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-123';
const testToken = jwt.sign({ id: 1, username: 'testuser' }, JWT_SECRET, { expiresIn: '1h' });

describe('Backend API Tests', () => {
  it('GET /api/projects should return an array', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/pick-folder should return a mocked path', async () => {
    const res = await request(app)
      .get('/api/pick-folder')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.path).toBe('/mocked/path');
  });

  describe('GET /api/fs/directories', () => {
    it('should return current directory and drives list', async () => {
      const res = await request(app)
        .get('/api/fs/directories')
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('currentPath');
      expect(Array.isArray(res.body.directories)).toBe(true);
      expect(Array.isArray(res.body.drives)).toBe(true);
      expect(res.body.drives.length).toBeGreaterThan(0);
    });

    it('should return list of drives when querying path=DRIVES', async () => {
      const res = await request(app)
        .get('/api/fs/directories?path=DRIVES')
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.directories)).toBe(true);
      if (process.platform === 'win32') {
        expect(res.body.currentPath).toBe('');
        expect(res.body.parentPath).toBeNull();
        expect(res.body.directories.length).toBeGreaterThan(0);
        expect(res.body.directories[0].isDrive).toBe(true);
      }
    });

    it('should return 404 for non-existent path', async () => {
      const res = await request(app)
        .get('/api/fs/directories?path=' + encodeURIComponent('Z:\\invalid_folder_9999_xyz'))
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('nie istnieje');
    });
  });

  it('POST /api/analyze should fail if no directory provided', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Missing directory');
  });

  it('GET /api/settings should return settings object', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.statusCode).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  it('POST /api/settings should save LLM config in DB', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        llmUrl: 'http://localhost:11434',
        llmName: 'Ollama',
        llmModel: 'llama3:latest'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  describe('LLM Servers API Endpoints', () => {
    it('GET /api/llm-servers should return list of servers', async () => {
      const res = await request(app)
        .get('/api/llm-servers')
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/llm-servers should validate required name and url', async () => {
      const res = await request(app)
        .post('/api/llm-servers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ name: 'Test Server' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Name and URL are required');
    });

    it('POST /api/llm-servers should create a new server', async () => {
      const res = await request(app)
        .post('/api/llm-servers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'LM Studio Local',
          url: 'http://127.0.0.1:1337/v1',
          model: 'AtomicChat/qwen35-4b',
          provider: 'LM Studio'
        });
      expect(res.statusCode).toBe(200);
    });

    it('GET /api/llm-servers/export should download json', async () => {
      const res = await request(app)
        .get('/api/llm-servers/export')
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('POST /api/llm-servers/import should import servers array', async () => {
      const res = await request(app)
        .post('/api/llm-servers/import')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          servers: [
            { name: 'Ollama Remote', url: 'http://192.168.1.50:11434/v1', model: 'llama3.2', provider: 'Ollama' }
          ]
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Git Repository API Endpoints', () => {
    it('POST /api/git/checkout should require branch', async () => {
      const res = await request(app)
        .post('/api/git/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ directory: '/mocked/path' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Branch name is required');
});

    it('POST /api/git/commit should require message', async () => {
      const res = await request(app)
        .post('/api/git/commit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ directory: '/mocked/path' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Commit message is required');
    });

    it('POST /api/git/clone should require repoUrl and targetDir', async () => {
      const res = await request(app)
        .post('/api/git/clone')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Repository URL is required');
    });
  });
});


