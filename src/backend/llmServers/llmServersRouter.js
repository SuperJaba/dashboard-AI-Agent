import express from 'express';
import * as llmRepo from './llmServersRepository.js';

export const llmServersRouter = express.Router();

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
        count: foundModels.length,
        models: foundModels,
        loadedModel: loadedModel || foundModels[0]
      });
    }

    return res.status(404).json({
      error: lastError || 'Nie udało się pobrać modeli z podanego adresu URL'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

