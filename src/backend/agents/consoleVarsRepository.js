import { pool } from '../db.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { saveSettings } from '../settings/settingsRepository.js';

export function normalizeBaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return 'http://127.0.0.1:8888/v1';
  let url = rawUrl.trim().replace(/\/+$/, '');
  url = url.replace(/\/chat\/completions$/, '').replace(/\/completions$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  // Ensure it has /v1 if missing for OpenAI compatibility
  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }
  return url;
}

export function getCleanRootBase(url) {
  const norm = normalizeBaseUrl(url);
  return norm.endsWith('/v1') ? norm.slice(0, -3) : norm;
}

export function buildExportCommands({ token = '', model = 'unsloth/Qwen3.5-9B-MTP-GGUF', ip = 'http://127.0.0.1:8888/v1' }) {
  const formattedUrl = normalizeBaseUrl(ip);
  const cleanRoot = getCleanRootBase(formattedUrl);
  const safeToken = token || 'sk-local-token';
  const safeModel = model || 'unsloth/Qwen3.5-9B-MTP-GGUF';

  const bash = [
    `export OPENAI_BASE_URL="${formattedUrl}"`,
    `export OPENAI_API_KEY="${safeToken}"`,
    `export OPENAI_MODEL="${safeModel}"`,
    `export ANTHROPIC_BASE_URL="${cleanRoot}"`,
    `export ANTHROPIC_API_KEY="${safeToken}"`,
    `export ANTHROPIC_MODEL="${safeModel}"`,
    `export CODEX_OSS_BASE_URL="${formattedUrl}"`
  ].join('\n');

  const powershell = [
    `$env:OPENAI_BASE_URL = "${formattedUrl}"`,
    `$env:OPENAI_API_KEY = "${safeToken}"`,
    `$env:OPENAI_MODEL = "${safeModel}"`,
    `$env:ANTHROPIC_BASE_URL = "${cleanRoot}"`,
    `$env:ANTHROPIC_API_KEY = "${safeToken}"`,
    `$env:ANTHROPIC_MODEL = "${safeModel}"`,
    `$env:CODEX_OSS_BASE_URL = "${formattedUrl}"`
  ].join('\n');

  const envFile = [
    `OPENAI_BASE_URL=${formattedUrl}`,
    `OPENAI_API_KEY=${safeToken}`,
    `OPENAI_MODEL=${safeModel}`,
    `ANTHROPIC_BASE_URL=${cleanRoot}`,
    `ANTHROPIC_API_KEY=${safeToken}`,
    `ANTHROPIC_MODEL=${safeModel}`,
    `CODEX_OSS_BASE_URL=${formattedUrl}`
  ].join('\n');

  return { bash, powershell, env: envFile };
}

export async function getConsoleVars() {
  const { rows } = await pool.query('SELECT * FROM console_variables WHERE id = 1');
  let token = '';
  let model = 'unsloth/Qwen3.5-9B-MTP-GGUF';
  let ip = 'http://127.0.0.1:8888/v1';

  if (rows && rows.length > 0) {
    const r = rows[0];
    model = r.model || model;
    ip = r.ip || ip;
    if (r.token) {
      try {
        token = decrypt(r.token);
      } catch {
        token = r.token;
      }
    }
  } else {
    // Check if settings table has existing values
    const settingsRes = await pool.query("SELECT key, value FROM settings WHERE key IN ('llmUrl', 'apiKey', 'llmModel')");
    (settingsRes.rows || []).forEach(row => {
      if (row.key === 'llmUrl' && row.value) ip = row.value;
      if (row.key === 'llmModel' && row.value) model = row.value;
      if (row.key === 'apiKey' && row.value) {
        try {
          token = decrypt(row.value);
        } catch {
          token = row.value;
        }
      }
    });
    // Insert initial row
    await pool.query(
      'INSERT INTO console_variables (id, token, model, ip) VALUES (1, $1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [token ? encrypt(token) : '', model, ip]
    );
  }

  const exportCommands = buildExportCommands({ token, model, ip });
  return {
    id: 1,
    token,
    model,
    ip,
    exportCommands
  };
}

export async function saveConsoleVars({ token, model, ip }) {
  const normIp = normalizeBaseUrl(ip || 'http://127.0.0.1:8888/v1');
  const safeModel = (model || 'unsloth/Qwen3.5-9B-MTP-GGUF').trim();
  const safeToken = typeof token === 'string' ? token.trim() : '';
  const encryptedToken = safeToken ? encrypt(safeToken) : '';

  await pool.query(
    `INSERT INTO console_variables (id, token, model, ip, updated_at)
     VALUES (1, $1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       token = EXCLUDED.token,
       model = EXCLUDED.model,
       ip = EXCLUDED.ip,
       updated_at = CURRENT_TIMESTAMP`,
    [encryptedToken, safeModel, normIp]
  );

  // Sync with central settings table so all LLM components remain unified
  await saveSettings({
    llmUrl: normIp,
    apiKey: safeToken,
    llmModel: safeModel
  });

  const exportCommands = buildExportCommands({ token: safeToken, model: safeModel, ip: normIp });
  return {
    success: true,
    token: safeToken,
    model: safeModel,
    ip: normIp,
    exportCommands
  };
}

export async function testConsoleConnection({ token, model, ip }) {
  const normIp = normalizeBaseUrl(ip || 'http://127.0.0.1:8888/v1');
  const cleanRoot = getCleanRootBase(normIp);
  const safeToken = token ? token.trim() : '';

  const headers = {
    'Content-Type': 'application/json',
    ...(safeToken ? { 'Authorization': `Bearer ${safeToken}` } : {})
  };

  const startTime = Date.now();
  let latency = null;
  let speed = null;
  let serverType = 'OpenAI-compatible';
  let loadedModel = model || 'Brak';
  let status = 'failed';
  let error = null;

  try {
    // 1. Probe /v1/models (using cleanRoot/v1/models so /v1 is never doubled!)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    let modelsRes = await fetch(`${cleanRoot}/v1/models`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    if (modelsRes.status === 401 && safeToken) {
      const retryNoAuth = await fetch(`${cleanRoot}/v1/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      if (retryNoAuth.ok) modelsRes = retryNoAuth;
    }
    clearTimeout(timeoutId);

    const serverHeader = modelsRes.headers.get('server') || '';
    if (serverHeader.toLowerCase().includes('unsloth')) {
      serverType = 'Unsloth Studio';
    } else if (normIp.includes('1234') || serverHeader.toLowerCase().includes('lmstudio')) {
      serverType = 'LM Studio';
    } else if (normIp.includes('11434')) {
      serverType = 'Ollama';
    } else if (normIp.includes('8000')) {
      serverType = 'vLLM';
    }

    if (modelsRes.ok) {
      latency = Date.now() - startTime;
      status = 'success';
      const modelsData = await modelsRes.json().catch(() => ({}));
      if (Array.isArray(modelsData.data) && modelsData.data.length > 0) {
        const active = modelsData.data.find(m => m.loaded === true || m.status?.value === 'loaded') || modelsData.data[0];
        if (active?.id) loadedModel = active.id;
        else if (active?.display_name) loadedModel = active.display_name;
      }
    } else if (modelsRes.status === 401 || modelsRes.status === 403) {
      status = 'unauthorized';
      error = 'Błąd uwierzytelnienia (Wymagany poprawny Token / API Key)';
    }

    // 2. Quick TTFT / throughput check via chat completions
    if (status === 'success') {
      try {
        const chatController = new AbortController();
        const chatTimeout = setTimeout(() => chatController.abort(), 3000);
        const chatStart = Date.now();

        const chatRes = await fetch(`${cleanRoot}/v1/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: loadedModel || model || 'test',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 10,
            temperature: 0.1
          }),
          signal: chatController.signal
        });
        clearTimeout(chatTimeout);

        if (chatRes.ok) {
          const chatData = await chatRes.json().catch(() => ({}));
          const chatDuration = (Date.now() - chatStart) / 1000;
          const tokens = chatData?.usage?.completion_tokens || 8;
          if (chatDuration > 0) {
            speed = Math.round((tokens / chatDuration) * 10) / 10;
          }
          latency = Date.now() - chatStart;
        }
      } catch {
        // If chat completion probe fails or model is loading, keep /v1/models latency
      }
    }

  } catch (err) {
    status = 'offline';
    error = err.name === 'AbortError' ? 'Przekroczono limit czasu połączenia (Timeout 2.5s)' : (err.message || 'Brak połączenia z adresem IP');
  }

  return {
    success: status === 'success',
    status,
    serverType,
    latency,
    speed,
    loadedModel,
    ip: normIp,
    error
  };
}
