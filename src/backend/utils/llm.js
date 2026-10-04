
/**
 * Dynamically queries the configured LLM endpoint to discover loaded models.
 * Falls back to a safe default if models cannot be retrieved.
 */
export async function getBestAvailableModel(llmUrl, apiKey) {
  if (!llmUrl) {return 'gpt-4o';}

  try {
    // 1. Check for standard OpenAI-compatible /v1/models endpoint
    const baseUrl = llmUrl.endsWith('/chat/completions') 
      ? llmUrl.replace('/chat/completions', '') 
      : (llmUrl.endsWith('/') ? llmUrl.slice(0, -1) : llmUrl);
    
    const modelsUrl = `${baseUrl}/models`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsUrl, { headers, timeout: 2000 });
    if (response.ok) {
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        // Return the first available model ID (e.g., loaded local model)
        return data.data[0].id;
      }
    }
  } catch  {
    // Fallback and try Ollama tags endpoint directly
    try {
      if (llmUrl.includes('11434') || llmUrl.includes('ollama')) {
        const ollamaRes = await fetch('http://localhost:11434/api/tags', { timeout: 1500 });
        if (ollamaRes.ok) {
          const data = await ollamaRes.json();
          if (data && data.models && data.models.length > 0) {
            return data.models[0].name;
          }
        }
      }
    } catch  {
      // Ignore and proceed to fallback
    }
  }

  // Generic fallback
  return 'gpt-4o';
}
