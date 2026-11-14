import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as settingsRepo from './settingsRepository.js';
import { z } from 'zod';

const SettingsSchema = z.object({
  llmUrl: z.string().optional().or(z.literal('')),
  apiKey: z.string().optional().or(z.literal('')),
  llmName: z.string().optional(),
  llmModel: z.string().optional(),
  useBrowserTerminal: z.union([z.boolean(), z.string()]).optional()
}).passthrough();

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

export function normalizeLlmBase(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim().replace(/\/+$/, '');
  url = url.replace(/\/chat\/completions$/, '').replace(/\/completions$/, '');
  if (url.endsWith('/v1')) {
    url = url.slice(0, -3);
  }
  return url;
}

// Auto-tune and scan LLM servers
settingsRouter.post('/llm/tune', async (req, res) => {
  try {
    const { llmUrl: currentUrl, apiKey } = await settingsRepo.getLlmCredentials();

    let autoDetectedUrl = '';
    let autoDetectedType = '';
    let latency = null;
    let speed = null;
    let status = 'failed';
    const recommendations = [];

    const localLLMs = [
      { url: 'http://127.0.0.1:8888/v1', type: 'Unsloth Studio' },
      { url: 'http://localhost:8888/v1', type: 'Unsloth Studio' },
      { url: 'http://10.10.10.30:8888/v1', type: 'Unsloth Studio' },
      { url: 'http://localhost:11434', type: 'Ollama' },
      { url: 'http://localhost:1234/v1', type: 'LM Studio' },
      { url: 'http://localhost:8000/v1', type: 'vLLM / local API' }
    ];

    const testUrls = [];
    if (currentUrl) {
      testUrls.push({ url: currentUrl, type: 'Current' });
    }
    localLLMs.forEach(item => {
      if (!currentUrl || !currentUrl.includes(item.url)) {
        testUrls.push(item);
      }
    });

    for (const target of testUrls) {
      const base = normalizeLlmBase(target.url);
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        // Try OpenAI /v1/models GET request first (clean base guarantees no /v1/v1 doubling)
        const modelsRes = await fetch(`${base}/v1/models`, {
          method: 'GET',
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (modelsRes.ok || modelsRes.status === 401 || modelsRes.status === 403) {
          latency = Date.now() - startTime;
          autoDetectedUrl = target.url;
          const srv = (modelsRes.headers.get('server') || '').toLowerCase();
          if (srv.includes('unsloth')) {
            autoDetectedType = 'Unsloth Studio';
          } else if (srv.includes('lmstudio') || target.url.includes('1234')) {
            autoDetectedType = 'LM Studio';
          } else if (srv.includes('ollama') || target.url.includes('11434')) {
            autoDetectedType = 'Ollama';
          } else if (srv.includes('vllm') || target.url.includes('8000')) {
            autoDetectedType = 'vLLM';
          } else {
            autoDetectedType = target.type === 'Current' ? 'OpenAI-compatible LLM' : target.type;
          }
          status = 'success';
          break;
        }
      } catch {
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
            const srv = (response.headers.get('server') || '').toLowerCase();
            if (srv.includes('unsloth')) {
              autoDetectedType = 'Unsloth Studio';
            } else if (srv.includes('lmstudio') || target.url.includes('1234')) {
              autoDetectedType = 'LM Studio';
            } else if (srv.includes('ollama') || target.url.includes('11434')) {
              autoDetectedType = 'Ollama';
            } else if (srv.includes('vllm') || target.url.includes('8000')) {
              autoDetectedType = 'vLLM';
            } else {
              autoDetectedType = target.type === 'Current' ? 'OpenAI-compatible LLM' : target.type;
            }
            status = 'success';
            break;
          }
        } catch {
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
              autoDetectedType = target.type === 'Current' ? 'OpenAI-compatible LLM' : target.type;
              status = 'success';
              break;
            }
          } catch {
            // Continue scanning
          }
        }
      }
    }

    if (status === 'success') {
      recommendations.push(`Connected to ${autoDetectedType} LLM server at ${autoDetectedUrl}.`);
      if (latency !== null) {recommendations.push(`Latency: ${latency}ms.`);}

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
          recommendations.push('Ollama detected running locally on port 11434. Standard OpenAI endpoints are active.');
          await settingsRepo.saveSettings({ llmUrl: autoDetectedUrl });
        }
      } catch {
        recommendations.push('No local or configured LLM server detected. Please ensure Ollama (11434) or LM Studio (1234) is running.');
      }
    }

    // 1. Detect currently loaded model
    let loadedModel = 'Brak / Nie wykryto';
    const targetUrl = autoDetectedUrl || currentUrl;
    if (status === 'success' && targetUrl) {
      if (autoDetectedType === 'Ollama' || targetUrl.includes('11434')) {
        try {
          const psRes = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/ps`);
          if (psRes.ok) {
            const psData = await psRes.json();
            if (psData.models && psData.models.length > 0) {
              loadedModel = psData.models.map(m => m.name).join(', ');
            } else {
              const tagsRes = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/tags`);
              if (tagsRes.ok) {
                const tagsData = await tagsRes.json();
                if (tagsData.models && tagsData.models.length > 0) {
                  loadedModel = `${tagsData.models[0].name} (Standby)`;
                }
              }
            }
          }
        } catch {
          // Fallback
        }
      } else {
        try {
          const base = normalizeLlmBase(targetUrl);
          let modelsRes = await fetch(`${base}/v1/models`, {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
          });
          if (modelsRes.status === 401 && apiKey) {
            const noAuthRes = await fetch(`${base}/v1/models`);
            if (noAuthRes.ok) modelsRes = noAuthRes;
          }
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (Array.isArray(modelsData.data) && modelsData.data.length > 0) {
              const active = modelsData.data.find(m => m.loaded === true || m.status?.value === 'loaded') || modelsData.data[0];
              loadedModel = active?.id || active?.display_name || active?.name || 'Brak aktywnych modeli';
            }
          }
        } catch {
          // Fallback
        }
      }
    }

    // 2. Measure actual generation speed (throughput in tokens/sec)
    if (status === 'success' && targetUrl) {
      try {
        const base = normalizeLlmBase(targetUrl);
        const chatController = new AbortController();
        const chatTimeout = setTimeout(() => chatController.abort(), 3000);
        const chatStart = Date.now();
        let chatRes = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({
            model: loadedModel !== 'Brak / Nie wykryto' ? loadedModel : 'test',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 10,
            temperature: 0.1
          }),
          signal: chatController.signal
        });
        if (chatRes.status === 401 && apiKey) {
          chatRes = await fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: loadedModel !== 'Brak / Nie wykryto' ? loadedModel : 'test',
              messages: [{ role: 'user', content: 'Say OK' }],
              max_tokens: 10,
              temperature: 0.1
            }),
            signal: chatController.signal
          });
        }
        clearTimeout(chatTimeout);
        if (chatRes.ok) {
          const chatData = await chatRes.json().catch(() => ({}));
          const durationSec = (Date.now() - chatStart) / 1000;
          const tokens = chatData?.usage?.completion_tokens || 8;
          if (durationSec > 0) {
            speed = Math.round((tokens / durationSec) * 10) / 10;
          }
          if (latency === null) latency = Date.now() - chatStart;
        }
      } catch {
        // chat completion speed probe optional
      }
    }

    if (speed !== null) {
      recommendations.push(`Generation Speed: ~${speed} tokens/sec.`);
      if (speed < 10) {
        recommendations.push('Moderate generation speed. Suggest offloading more layers to GPU/Metal.');
      } else {
        recommendations.push('Excellent speed and throughput.');
      }
    }

    // 2. Fetch system resources (CPU, RAM, GPU/VRAM)
    const gpuInfo = detectGpuInfo();

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

export function detectGpuInfo() {
  // 0. Try macOS Apple Silicon / Metal
  if (process.platform === 'darwin') {
    try {
      const sp = execSync('system_profiler SPDisplaysDataType', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2500
      });
      const chipMatch = sp.match(/Chipset Model:\s*(.+)/i);
      const coresMatch = sp.match(/Total Number of Cores:\s*(\d+)/i);
      const metalMatch = sp.match(/Metal Support:\s*(.+)/i);
      if (chipMatch) {
        const chip = chipMatch[1].trim();
        const cores = coresMatch ? `${coresMatch[1].trim()}x GPU Cores` : '';
        const metal = metalMatch ? metalMatch[1].trim() : 'Metal';
        return `${chip} (${[cores, metal, 'Unified Memory'].filter(Boolean).join(', ')})`;
      }
    } catch {
      // system_profiler failed, try sysctl fallback
    }
    try {
      const brand = execSync('sysctl -n machdep.cpu.brand_string', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1000
      }).trim();
      if (brand && brand.includes('Apple')) {
        return `${brand} (Integrated Metal GPU / Unified Memory)`;
      }
    } catch {
      // fallback
    }
  }

  // 1. Try NVIDIA SMI
  try {
    const smi = execSync('nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free --format=csv,noheader,nounits', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    });
    if (smi && smi.trim()) {
      const parsed = smi.trim().split('\n').map(line => {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const name = parts[0].trim();
          const total = parseInt(parts[1].trim(), 10);
          const used = parseInt(parts[2].trim(), 10);
          return `${name} (${used}/${total} MB VRAM)`;
        }
        return line.trim();
      }).join(', ');
      if (parsed) return parsed;
    }
  } catch {
    // No nvidia-smi
  }

  // 2. Try ROCm SMI (AMD)
  try {
    const rocm = execSync('rocm-smi --showmeminfo vram --showid --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    });
    if (rocm && rocm.trim()) {
      const data = JSON.parse(rocm.trim());
      const gpus = [];
      for (const key of Object.keys(data)) {
        const card = data[key];
        const name = card['Device Name'] || 'AMD Radeon';
        const totalB = parseInt(card['VRAM Total Memory (B)'] || '0', 10);
        const usedB = parseInt(card['VRAM Total Used Memory (B)'] || '0', 10);
        if (totalB > 0) {
          const totalMb = Math.round(totalB / (1024 * 1024));
          const usedMb = Math.round(usedB / (1024 * 1024));
          gpus.push(`${name} (${usedMb}/${totalMb} MB VRAM)`);
        } else {
          gpus.push(name);
        }
      }
      if (gpus.length > 0) return gpus.join(', ');
    }
  } catch {
    // No rocm-smi
  }

  // 3. Fallback: Linux sysfs /sys/class/drm/ + lspci
  try {
    const drmPath = '/sys/class/drm';
    if (fs.existsSync(drmPath)) {
      const entries = fs.readdirSync(drmPath);
      const cardDirs = entries.filter(e => /^card\d+$/.test(e));
      for (const card of cardDirs) {
        const totalPath = path.join(drmPath, card, 'device', 'mem_info_vram_total');
        const usedPath = path.join(drmPath, card, 'device', 'mem_info_vram_used');
        if (fs.existsSync(totalPath)) {
          const totalB = parseInt(fs.readFileSync(totalPath, 'utf8').trim(), 10);
          const usedB = fs.existsSync(usedPath) ? parseInt(fs.readFileSync(usedPath, 'utf8').trim(), 10) : 0;
          let name = 'AMD Radeon GPU';
          try {
            const lspciOut = execSync('lspci | grep -i -E "vga|3d|display"', {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 2000
            });
            const match = lspciOut.match(/controller:\s*([^(\n]+)/i);
            if (match) name = match[1].trim();
          } catch {
            // Ignore lspci error
          }
          const totalMb = Math.round(totalB / (1024 * 1024));
          const usedMb = Math.round(usedB / (1024 * 1024));
          return `${name} (${usedMb}/${totalMb} MB VRAM)`;
        }
      }
    }
  } catch {
    // sysfs read error
  }

  // 4. Fallback: lspci (without VRAM details)
  try {
    const lspci = execSync('lspci | grep -i -E "vga|3d|display"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    });
    if (lspci && lspci.trim()) {
      const lines = lspci.trim().split('\n');
      return lines.map(line => {
        const parts = line.split(':');
        return parts.length > 2 ? parts.slice(2).join(':').trim() : line.trim();
      }).join(', ');
    }
  } catch {
    // lspci not found
  }

  return 'Brak dedykowanego GPU / brak sterowników';
}

