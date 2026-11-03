import express from 'express';
import * as llmRepo from './llmServersRepository.js';
import { getAggregatedRouterStats, resetRouterCircuitBreaker } from '../llm/modelRouter.js';
import { broadcastRoutingStats } from '../socket/dashboardNamespace.js';

export const llmServersRouter = express.Router();

// Get Model Routing Stats & Circuit Breaker status
const handleGetRoutingStats = async (req, res) => {
  try {
    let activeEndpoint = null;
    let activeModel = null;
    try {
      const servers = await llmRepo.getLlmServers();
      const active = servers.find((s) => s.is_active);
      if (active) {
        if (active.url) activeEndpoint = active.url;
        if (active.model) activeModel = active.model;
      }
    } catch {}

    const stats = await getAggregatedRouterStats({
      activeLocalModel: activeModel,
      activeEndpoint: activeEndpoint,
    });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

llmServersRouter.get('/llm/routing/stats', handleGetRoutingStats);
llmServersRouter.get('/llm/routing-stats', handleGetRoutingStats);

// Reset Circuit Breaker manually
llmServersRouter.post('/llm/routing/circuit/reset', async (req, res) => {
  try {
    resetRouterCircuitBreaker();
    let activeEndpoint = null;
    let activeModel = null;
    try {
      const servers = await llmRepo.getLlmServers();
      const active = servers.find((s) => s.is_active);
      if (active) {
        if (active.url) activeEndpoint = active.url;
        if (active.model) activeModel = active.model;
      }
    } catch {}

    const stats = await getAggregatedRouterStats({
      activeLocalModel: activeModel,
      activeEndpoint: activeEndpoint,
    });
    broadcastRoutingStats(stats);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Discover available models from LLM server URL
llmServersRouter.post('/llm-servers/fetch-models', async (req, res) => {
  const { url, apiKey } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Pole "url" jest wymagane' });
  }

  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const candidateUrls = [
      cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`,
      `${cleanUrl}/models`,
      `${cleanUrl}/api/tags`
    ];

    let foundModels = [];
    let loadedModel = null;
    let lastError = null;

    for (const testUrl of candidateUrls) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const resp = await fetch(testUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(4000)
        });

        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json.data)) {
            foundModels = json.data.map(m => typeof m === 'string' ? m : m.id).filter(Boolean);
            const loaded = json.data.find(m => m.loaded);
            if (loaded) loadedModel = loaded.id;
            break;
          }
          if (Array.isArray(json.models)) {
            foundModels = json.models.map(m => m.name || m.model).filter(Boolean);
            break;
          }
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (foundModels.length > 0) {
      return res.json({
        success: true,
        models: foundModels,
        loadedModel,
        count: foundModels.length
      });
    }

    return res.status(404).json({
      error: lastError || 'Nie udało się pobrać modeli z podanego adresu URL'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    broadcastRoutingStats();
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update LLM Server
llmServersRouter.put('/llm-servers/:id', async (req, res) => {
  try {
    const server = await llmRepo.updateLlmServer(req.params.id, req.body);
    broadcastRoutingStats();
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete LLM Server
llmServersRouter.delete('/llm-servers/:id', async (req, res) => {
  try {
    const result = await llmRepo.deleteLlmServer(req.params.id);
    broadcastRoutingStats();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Select Active LLM Server
llmServersRouter.post('/llm-servers/select/:id', async (req, res) => {
  try {
    const selected = await llmRepo.selectLlmServer(req.params.id);
    broadcastRoutingStats();
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
