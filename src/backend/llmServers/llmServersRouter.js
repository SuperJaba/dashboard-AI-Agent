import express from 'express';
import * as llmRepo from './llmServersRepository.js';
import { getRouterStats, resetRouterCircuitBreaker } from '../llm/modelRouter.js';

export const llmServersRouter = express.Router();

// Get Model Routing Stats & Circuit Breaker status
llmServersRouter.get('/llm/routing/stats', (req, res) => {
  try {
    const stats = getRouterStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Circuit Breaker manually
llmServersRouter.post('/llm/routing/circuit/reset', (req, res) => {
  try {
    const stats = resetRouterCircuitBreaker();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all LLM Servers
llmServersRouter.get('/llm-servers', async (req, res) => {
  try {
    const servers = await llmRepo.getLlmServers();
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new LLM Server
llmServersRouter.post('/llm-servers', async (req, res) => {
  try {
    const { name, url, apiKey, model, provider, is_active } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
    const server = await llmRepo.createLlmServer({ name, url, apiKey, model, provider, is_active });
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update LLM Server
llmServersRouter.put('/llm-servers/:id', async (req, res) => {
  try {
    const server = await llmRepo.updateLlmServer(req.params.id, req.body);
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete LLM Server
llmServersRouter.delete('/llm-servers/:id', async (req, res) => {
  try {
    const result = await llmRepo.deleteLlmServer(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Select Active LLM Server
llmServersRouter.post('/llm-servers/select/:id', async (req, res) => {
  try {
    const selected = await llmRepo.selectLlmServer(req.params.id);
    res.json({ success: true, selected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export LLM Servers to JSON
llmServersRouter.get('/llm-servers/export', async (req, res) => {
  try {
    const servers = await llmRepo.getLlmServers();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="llm_servers.json"');
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import LLM Servers from JSON
llmServersRouter.post('/llm-servers/import', async (req, res) => {
  try {
    const { servers } = req.body;
    if (!Array.isArray(servers)) {
      return res.status(400).json({ error: 'Payload must contain a "servers" array' });
    }
    const imported = await llmRepo.importLlmServers(servers);
    res.json({ success: true, count: imported.length, servers: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
