# Unsloth Studio & AgentMemory Configuration & Tuning Guide

Dokumentacja techniczna z audytu, optymalizacji parametrów inferencji modelu **Qwen3.5-9B-MTP** w **Unsloth Studio** oraz pełnej integracji z demonem pamięci długoterminowej **AgentMemory** na platformie macOS (Apple Silicon M4 Pro).

Data wdrożenia: 2026-11-06  
Środowisko: Apple MacBook Pro (M4 Pro 14 rdzeni, 48 GB Unified Memory)

---

## 1. Tuning modelu `unsloth/Qwen3.5-9B-MTP-GGUF:Q8_0` w Unsloth Studio

### 1.1. Profil sprzętowy i model
* **Model bazowy:** `unsloth/Qwen3.5-9B-MTP-GGUF` (wariant `Q8_0`, rozmiar wag: ~9.8 GB).
* **Architektura:** Hybrydowa architektura Qwen 3.5 Small (warstwy liniowej uwagi / SSM + standardowa uwaga) z wbudowaną warstwą Multi-Token Prediction (`qwen35.nextn_predict_layers: 1`).
* **Natywny kontekst:** 262 144 tokeny (256K).
* **Aktywny limit kontekstu:** 107 008 tokenów.

### 1.2. Zidentyfikowane błędy w konfiguracji początkowej
1. **Zawyżona kara za obecność (`presence_penalty = 1.5`):**
   * *Problem:* Wartość 1.5 została przeniesiona z szablonu ogólnego czatu kreatywnego z myśleniem (*thinking mode*). W zadaniach programistycznych i agentowych (np. Claude Code, CLI agent) kara za obecność 1.5 drastycznie degraduje jakość kodu, ponieważ składnia języków programowania naturalnie wymaga częstych powtórzeń słów kluczowych (`def`, `return`, `const`, `import`), nawiasów oraz nazw zmiennych. Skutkowało to halucynacjami nazw zmiennych i błędami w wywołaniach narzędzi JSON (*tool calling*).
   * *Korekta:* Zredukowano do **`0.0`**.
2. **Temperatura inferencji (`temperature = 1.01`):**
   * *Problem:* Dla trybu bez myślenia (*reasoning off* / agentic coding) temperatura 1.01 powodowała nadmierną dyspersję tokenów i błędy składni.
   * *Korekta:* Ustawiono profil bazowy **`0.7`** (ogólny) oraz zalecenie **`0.0 - 0.2`** dla deterministycznego kodowania.
3. **Niedopasowany preset:**
   * Aktywny preset w UI wskazywał na profil modelu 27B (`Qwen3.8-27B`). Przełączono na dedykowany preset `Qwen3.5-9B-MTP`.
4. **Alokacja pamięci podręcznej KV (KV Cache):**
   * Poprzednia konfiguracja używała `kv_cache_dtype: q4_0`.
   * Ze względu na 48 GB pamięci Unified RAM (maksymalny roboczy zestaw GPU ~40.2 GB), w override ustawiono **`q8_0`**. Przy kontekście 107K tokenów zużycie pamięci wzrasta jedynie do ~18.9 GB (wliczając wagi i bufory obliczeniowe), całkowicie eliminując artefakty kwantyzacji uwagi przy długich promptach.
5. **Równoległość slotów:**
   * Domyślne `--parallel 4` rozbijało pamięć prompt cache na 4 sloty. Dla lokalnej pracy jednoosobowej / agenta CLI (`n_parallel: 1`) gwarantuje 100% przepustowości Metal i pamięci cache dla jednego zapytania.

### 1.3. Parametry pracy MTP (Multi-Token Prediction)
Inference serwera `llama-server` uruchomiona z flagami:
* `--spec-type draft-mtp`
* `--spec-draft-n-max 3`

**Zmierzone metryki na Apple M4 Pro:**
* **Prędkość przetwarzania promptu (prompt eval):** `280 – 425 tokenów/s`
* **Prędkość generowania (generation eval):** `24 – 38 tokenów/s`
* **Skuteczność akceptacji draftów MTP (Draft Acceptance Rate):** `48.9%` ogółem
  * Pozycja 1 (+1 token): `72.1%` akceptacji
  * Pozycja 2 (+2 tokeny): `46.6%` akceptacji
  * Pozycja 3 (+3 tokeny): `27.9%` akceptacji

### 1.4. Zaktualizowane wpisy konfiguracyjne w `studio.db`
Zaktualizowano tabele `app_settings` oraz `chat_settings` poprzez API portu `8888`:

* **`model_sampling_defaults`:**
  ```json
  {
    "unsloth/Qwen3.5-9B-MTP-GGUF": {
      "temperature": 0.7,
      "top_p": 0.8,
      "top_k": 20,
      "min_p": 0.0,
      "presence_penalty": 0.0,
      "repetition_penalty": 1.0
    }
  }
  ```
* **`openai_api_auto_switch_overrides`:**
  ```json
  {
    "unsloth/Qwen3.5-9B-MTP-GGUF:Q8_0": {
      "custom_context_length": 107008,
      "kv_cache_dtype": "q8_0",
      "speculative_type": "mtp",
      "spec_draft_n_max": 3,
      "n_parallel": 1,
      "disable_vision": true
    }
  }
  ```

---

## 2. Integracja z AgentMemory

Usługa **AgentMemory** została połączona bezpośrednio z instancją Unsloth Studio, która dostarcza zarówno endpoint LLM, jak i dedykowany endpoint wektorowy embeddings.

### 2.1. Zastosowana konfiguracja (`~/.agentmemory/.env`)

```ini
# =============================================================================
# LLM Provider — Unsloth Studio Local (Qwen 3.5 9B MTP)
# =============================================================================
AGENTMEMORY_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-unsloth-8a27e778cddd2c7f21803eeb477c2a05
OPENAI_BASE_URL=http://127.0.0.1:8888/v1
OPENAI_MODEL=unsloth/Qwen3.5-9B-MTP-GGUF
MAX_TOKENS=4096

# =============================================================================
# Embedding Provider — Unsloth Studio Local (bge-small-en-v1.5)
# =============================================================================
EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_BASE_URL=http://127.0.0.1:8888/v1
OPENAI_EMBEDDING_API_KEY=sk-unsloth-8a27e778cddd2c7f21803eeb477c2a05
OPENAI_EMBEDDING_MODEL=unsloth/bge-small-en-v1.5
OPENAI_EMBEDDING_DIMENSIONS=384

# =============================================================================
# Włączone zaawansowane mechanizmy pamięci
# =============================================================================
GRAPH_EXTRACTION_ENABLED=true
CONSOLIDATION_ENABLED=true
AGENTMEMORY_AUTO_COMPRESS=true
AGENTMEMORY_INJECT_CONTEXT=true
```

### 2.2. Weryfikacja statusu demona

Polecenie weryfikacyjne:
```bash
npx @agentmemory/agentmemory status
```

**Wynik weryfikacji:**
```text
Health:       ✓ healthy
Viewer:       http://localhost:3113
REST API:     http://localhost:3111
Provider:     ✓ llm (unsloth/Qwen3.5-9B-MTP-GGUF via http://127.0.0.1:8888/v1)
Embeddings:   ✓ openai (384 dims via unsloth/bge-small-en-v1.5)
Flags:
  ✓ GRAPH_EXTRACTION_ENABLED         Knowledge graph extraction
  ✓ CONSOLIDATION_ENABLED            Memory consolidation
  ✓ AGENTMEMORY_AUTO_COMPRESS        LLM-powered observation compression
  ✓ AGENTMEMORY_INJECT_CONTEXT       In-conversation context injection
Compose workers:
  state: ready
  http: ready
  agentmemory: ready
```

---

## 3. Weryfikacja zapytań pamięci

### 3.1. `memory_lesson_recall { "query": "deploy" }`
Wywołanie endpointu lekcji REST (`POST /agentmemory/lessons/search`):
```json
{
  "lessons": [],
  "success": true
}
```
*Status:* Brak zapisanych sformalizowanych lekcji typu `lesson` dla hasła „deploy”.

### 3.2. Wyszukiwanie semantyczne powiązanych faktów (`memory_recall`)
Zapytanie odnalazło powiązany rekord procedury wdrożeniowej:
* **ID:** `mem_mvymvmrc_b32f826ad644`
* **Typ:** `decision / workflow`
* **Treść:** *„Deployed frontend UI/UX automation package for dashboard: skills (frontend-design, a11y-audit, motion-recipes, react-19-patterns, new-component), subagents (ui-reviewer, ux-flow-reviewer, component-tester, security-reviewer, test-runner), and PostToolUse test runner hook. Verified total eager metadata overhead is bounded under 160 tokens.”*

---

## 4. Polecenia operacyjne (Cheat Sheet)

### Uruchomienie agenta kodującego Claude Code z optymalnym profilem
```bash
unsloth start claude \
  --model unsloth/Qwen3.5-9B-MTP-GGUF:Q8_0 \
  --context-length 100000 \
  --temperature 0.2 \
  --presence-penalty 0.0 \
  --reasoning off \
  --yolo
```

### Restart demona AgentMemory
```bash
npx @agentmemory/agentmemory stop && npx @agentmemory/agentmemory
```

### Podgląd pamięci i dashboardu AgentMemory
* Web Viewer: [http://localhost:3113](http://localhost:3113)
* REST API: [http://localhost:3111](http://localhost:3111)
