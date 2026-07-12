import express from 'express';
import os from 'os';
import { execSync } from 'child_process';
import * as settingsRepo from './settingsRepository.js';
import { SettingsSchema } from '../../shared/api-client/schemas.js';

export const settingsRouter = express.Router();

// Get Settings (LLM URL, API KEY)
settingsRouter.get('/', async (req, res) => {
  try {
    const settings = await settingsRepo.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Settings
settingsRouter.post('/', async (req, res) => {
  try {
    const { llmUrl, apiKey, llmName, llmModel, useBrowserTerminal } = SettingsSchema.parse(req.body);
    const result = await settingsRepo.saveSettings({ llmUrl, apiKey, llmName, llmModel, useBrowserTerminal });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-tune and scan LLM servers
settingsRouter.post('/llm/tune', async (req, res) => {
  try {
    const { llmUrl: currentUrl, apiKey } = await settingsRepo.getLlmCredentials();

    let autoDetectedUrl = '';
    let autoDetectedType = '';
    let latency = null;
    let speed = null;
    let status = 'failed';
    let recommendations = [];

    const localLLMs = [
      { url: 'http://localhost:11434', type: 'Ollama' },
      { url: 'http://localhost:1234/v1', type: 'LM Studio' },
      { url: 'http://localhost:8000/v1', type: 'vLLM / local API' }
    ];

    let testUrls = [];
    if (currentUrl) {
      testUrls.push({ url: currentUrl, type: 'Current' });
    }
    localLLMs.forEach(item => {
      if (!currentUrl || !currentUrl.includes(item.url)) {
        testUrls.push(item);
      }
    });

    for (const target of testUrls) {
      const base = target.url.endsWith('/chat/completions') 
        ? target.url.replace('/chat/completions', '') 
        : (target.url.endsWith('/') ? target.url.slice(0, -1) : target.url);
      
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        // Try OpenAI /v1/models GET request first
        const modelsRes = await fetch(`${base}/v1/models`, {
          method: 'GET',
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (modelsRes.ok || modelsRes.status === 401 || modelsRes.status === 403) {
          latency = Date.now() - startTime;
          autoDetectedUrl = target.url;
          autoDetectedType = target.type;
          status = 'success';
          break;
        }
      } catch (e) {
        // Fallback to /v1/chat/completions POST probe
        try {
          const checkUrl = `${base}/v1/chat/completions`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          const response = await fetch(checkUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
            },
            body: JSON.stringify({
              model: 'test',
              messages: [{ role: 'user', content: 'Say OK' }],
              max_tokens: 5
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (response.ok || response.status === 401 || response.status === 403) {
            latency = Date.now() - startTime;
            autoDetectedUrl = target.url;
            autoDetectedType = target.type;
            status = 'success';
            break;
          }
        } catch (err2) {
          // Fallback to /v1/completions POST probe
          try {
            const checkUrl = `${base}/v1/completions`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const response = await fetch(checkUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
              },
              body: JSON.stringify({
                model: 'test',
                prompt: 'Say OK',
                max_tokens: 5
              }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok || response.status === 401 || response.status === 403) {
              latency = Date.now() - startTime;
              autoDetectedUrl = target.url;
              autoDetectedType = target.type;
              status = 'success';
              break;
            }
          } catch (err3) {
            // Continue scanning
          }
        }
      }
    }

    if (status === 'success') {
      recommendations.push(`Connected to ${autoDetectedType} LLM server at ${autoDetectedUrl}.`);
      if (latency !== null) recommendations.push(`Latency: ${latency}ms.`);
      if (speed !== null) {
        recommendations.push(`Generation Speed: ~${speed} tokens/sec.`);
        if (speed < 10) recommendations.push("Slow generation. Suggest offloading more layers to GPU.");
        else recommendations.push("Excellent speed and throughput.");
      }

      if (autoDetectedUrl && currentUrl !== autoDetectedUrl) {
        await settingsRepo.saveSettings({ llmUrl: autoDetectedUrl });
        recommendations.push(`Auto-tuned and updated LLM Server URL in settings to: ${autoDetectedUrl}.`);
      }
    } else {
      try {
        const ollamaRes = await fetch('http://localhost:11434/api/tags');
        if (ollamaRes.ok) {
          status = 'success';
          autoDetectedUrl = 'http://localhost:11434';
          autoDetectedType = 'Ollama';
          recommendations.push("Ollama detected running locally on port 11434. Standard OpenAI endpoints are active.");
          await settingsRepo.saveSettings({ llmUrl: autoDetectedUrl });
        }
      } catch (e) {
        recommendations.push("No local or configured LLM server detected. Please ensure Ollama (11434) or LM Studio (1234) is running.");
      }
    }

    // 1. Detect currently loaded model
    let loadedModel = 'Brak / Nie wykryto';
    const targetUrl = autoDetectedUrl || currentUrl;
    if (status === 'success' && targetUrl) {
      if (autoDetectedType === 'Ollama' || targetUrl.includes('11434')) {
        try {
          const psRes = await fetch(`${targetUrl}/api/ps`);
          if (psRes.ok) {
            const psData = await psRes.json();
            if (psData.models && psData.models.length > 0) {
              loadedModel = psData.models.map(m => m.name).join(', ');
            } else {
              const tagsRes = await fetch(`${targetUrl}/api/tags`);
              if (tagsRes.ok) {
                const tagsData = await tagsRes.json();
                if (tagsData.models && tagsData.models.length > 0) {
                  loadedModel = `${tagsData.models[0].name} (Standby)`;
                }
              }
            }
          }
        } catch (e) {
          // Fallback
        }
      } else {
        try {
          const base = targetUrl.endsWith('/chat/completions') ? targetUrl.replace('/chat/completions', '') : targetUrl;
          const modelsRes = await fetch(`${base}/v1/models`);
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData.data && modelsData.data.length > 0) {
              loadedModel = modelsData.data[0].id;
            }
          }
        } catch (e) {
          // Fallback
        }
      }
    }

    // 2. Fetch system resources (CPU, RAM, GPU/VRAM)
    let gpuInfo = 'Brak GPU NVIDIA / brak sterowników';
    try {
      const smi = execSync('nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free --format=csv,noheader,nounits', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (smi) {
        gpuInfo = smi.trim().split('\n').map(line => {
          const parts = line.split(',');
          if (parts.length >= 3) {
            const name = parts[0].trim();
            const total = parseInt(parts[1].trim());
            const used = parseInt(parts[2].trim());
            return `${name} (${used}/${total} MB VRAM)`;
          }
          return line.trim();
        }).join(', ');
      }
    } catch (e) {
      // No nvidia-smi
    }

    const systemResources = {
      cpu: `${os.cpus().length}x Cores (${os.cpus()[0]?.model || 'Unknown CPU'})`,
      ram: `${((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(1)} / ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB`,
      gpu: gpuInfo
    };

    res.json({
      success: true,
      status,
      llmUrl: autoDetectedUrl || currentUrl,
      type: autoDetectedType || 'Unknown',
      latency,
      speed,
      loadedModel,
      systemResources,
      recommendations
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
