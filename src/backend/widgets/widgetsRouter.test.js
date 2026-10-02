import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { widgetsRouter } from './widgetsRouter.js';

describe('widgetsRouter', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/widgets', widgetsRouter);

  it('GET /api/widgets returns widgets array', async () => {
    const res = await request(app).get('/api/widgets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/widgets validates required fields', async () => {
    const res = await request(app).post('/api/widgets').send({ name: 'Only Name' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('CRUD lifecycle: creates, updates, runs, and deletes a widget', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/widgets')
      .send({
        name: 'Echo Test',
        command: 'echo "hello widget"',
        type: 'text',
        color: '#6366f1'
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body.name).toBe('Echo Test');
    const widgetId = createRes.body.id;

    // 2. Run
    const runRes = await request(app).get(`/api/widgets/${widgetId}/run`);
    expect(runRes.status).toBe(200);
    expect(runRes.body.result).toBe('hello widget');

    // 3. Update (PUT)
    const updateRes = await request(app)
      .put(`/api/widgets/${widgetId}`)
      .send({
        name: 'Echo Updated',
        command: 'echo "updated output"',
        type: 'text',
        color: '#10b981'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Echo Updated');
    expect(updateRes.body.color).toBe('#10b981');

    // 4. Run after update
    const runUpdatedRes = await request(app).get(`/api/widgets/${widgetId}/run`);
    expect(runUpdatedRes.status).toBe(200);
    expect(runUpdatedRes.body.result).toBe('updated output');

    // 5. Delete
    const deleteRes = await request(app).delete(`/api/widgets/${widgetId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ success: true });

    // 6. Verify Update on deleted returns 404
    const notFoundRes = await request(app)
      .put(`/api/widgets/${widgetId}`)
      .send({ name: 'Should Not Exist', command: 'echo 1' });
    expect(notFoundRes.status).toBe(404);
  });
});
