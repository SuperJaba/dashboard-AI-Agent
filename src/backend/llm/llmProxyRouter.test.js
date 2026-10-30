import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { llmProxyRouter } from './llmProxyRouter.js';
import { safeQuery } from '../db.js';

describe('llmProxyRouter', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/llm-proxy', llmProxyRouter);
    await safeQuery('DELETE FROM agent_tasks');
  });

  it('proxies request and records token usage from OpenAI format response', async () => {
    // Insert a test task into agent_tasks
    const taskRes = await safeQuery(
      `INSERT INTO agent_tasks (agent_name, project_id, status, model, tokens_used)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Open Claude', null, 'started', 'test-model', 0]
    );
    const taskId = taskRes.rows[0].id;

    // Create a mock upstream server
    const mockUpstream = express();
    mockUpstream.use(express.json());
    mockUpstream.post('/v1/chat/completions', (req, res) => {
      res.json({
        id: 'chatcmpl-123',
        choices: [{ message: { role: 'assistant', content: 'Hello test' } }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 10,
          total_tokens: 25,
        },
      });
    });

    const server = mockUpstream.listen(0);
    const port = server.address().port;
    const upstreamUrl = `http://127.0.0.1:${port}/v1`;

    try {
      const res = await request(app)
        .post('/api/llm-proxy/chat/completions')
        .set('x-target-url', upstreamUrl)
        .set('x-task-id', String(taskId))
        .send({ model: 'test-model', messages: [{ role: 'user', content: 'hi' }] });

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe('Hello test');

      // Verify agent_tasks was updated with 25 tokens
      const checkRes = await safeQuery('SELECT tokens_used FROM agent_tasks WHERE id = $1', [taskId]);
      expect(parseInt(checkRes.rows[0].tokens_used, 10)).toBe(25);
    } finally {
      server.close();
    }
  });

  it('records token usage from Anthropic format response', async () => {
    const taskRes = await safeQuery(
      `INSERT INTO agent_tasks (agent_name, project_id, status, model, tokens_used)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Claude Code', null, 'started', 'claude-3-5', 0]
    );
    const taskId = taskRes.rows[0].id;

    const mockUpstream = express();
    mockUpstream.use(express.json());
    mockUpstream.post('/v1/messages', (req, res) => {
      res.json({
        id: 'msg-123',
        content: [{ type: 'text', text: 'Anthropic response' }],
        usage: {
          input_tokens: 40,
          output_tokens: 20,
        },
      });
    });

    const server = mockUpstream.listen(0);
    const port = server.address().port;
    const upstreamUrl = `http://127.0.0.1:${port}/v1`;

    try {
      const res = await request(app)
        .post('/api/llm-proxy/messages')
        .set('x-target-url', upstreamUrl)
        .set('x-task-id', String(taskId))
        .send({ model: 'claude-3-5', messages: [{ role: 'user', content: 'hi' }] });

      expect(res.status).toBe(200);
      expect(res.body.content[0].text).toBe('Anthropic response');

      const checkRes = await safeQuery('SELECT tokens_used FROM agent_tasks WHERE id = $1', [taskId]);
      expect(parseInt(checkRes.rows[0].tokens_used, 10)).toBe(60);
    } finally {
      server.close();
    }
  });
});
