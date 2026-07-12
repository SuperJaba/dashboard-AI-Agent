import express from 'express';
import * as settingsRepo from './settingsRepository.js';

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
  const { llmUrl, apiKey, useBrowserTerminal } = req.body;
  try {
    const result = await settingsRepo.saveSettings({ llmUrl, apiKey, useBrowserTerminal });
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
      const startTime = Date.now();
      try {
        const checkUrl = target.url.endsWith('/chat/completions') 
          ? target.url 
          : (target.url.endsWith('/') ? target.url.slice(0, -1) : target.url) + '/chat/completions';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

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

        if (response.ok || response.status === 404 || response.status === 401) {
          latency = Date.now() - startTime;
          autoDetectedUrl = target.url;
          autoDetectedType = target.type;
          status = 'success';
          break;
        }
      } catch (e) {
        // Continue scanning
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

    res.json({
      success: true,
      status,
      llmUrl: autoDetectedUrl || currentUrl,
      type: autoDetectedType || 'Unknown',
      latency,
      speed,
      recommendations
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
