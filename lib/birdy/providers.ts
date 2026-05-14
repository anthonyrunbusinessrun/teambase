/**
 * lib/birdy/providers.ts
 * Birdy AI provider layer — Ollama-first, self-hosted enterprise architecture.
 *
 * PROVIDER HIERARCHY (in priority order):
 *   1. Ollama        — local inference, primary for all workloads
 *   2. vLLM          — GPU-accelerated self-hosted inference (optional)
 *   3. Claude/OpenAI — optional last-resort fallback (can be removed entirely)
 *
 * ADDING A NEW PROVIDER:
 *   Implement IModelProvider, register in PROVIDER_REGISTRY below.
 *   No other files need to change — the router works from the registry.
 */

// ── Core interfaces ────────────────────────────────────────────────────────

export interface ModelMessage {
  role:    'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChunk {
  delta: string
  done:  boolean
  error?: string
}

export interface IModelProvider {
  readonly providerName: string
  readonly modelName:    string
  readonly providerType: 'ollama' | 'vllm' | 'anthropic' | 'openai-compat'
  stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk>
  isAvailable(): Promise<boolean>
}

// ── Model availability cache ───────────────────────────────────────────────
// Avoids probing /api/tags on every request — 30s TTL per model.

const availabilityCache = new Map<string, { available: boolean; ts: number }>()
const CACHE_TTL = 30_000

export function getCachedAvailability(key: string): boolean | null {
  const entry = availabilityCache.get(key)
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null
  return entry.available
}
export function setCachedAvailability(key: string, available: boolean): void {
  availabilityCache.set(key, { available, ts: Date.now() })
}
export function invalidateAvailabilityCache(): void {
  availabilityCache.clear()
}

// ── 1. Ollama provider ─────────────────────────────────────────────────────

export class OllamaProvider implements IModelProvider {
  readonly providerType = 'ollama' as const

  constructor(readonly modelName: string) {}

  readonly providerName = 'ollama'

  private get baseUrl(): string {
    return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  }

  async isAvailable(): Promise<boolean> {
    const key = `ollama:${this.modelName}`
    const cached = getCachedAvailability(key)
    if (cached !== null) return cached

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      })
      if (!res.ok) { setCachedAvailability(key, false); return false }
      const data = await res.json()
      const prefix = this.modelName.split(':')[0]
      const available = (data.models ?? []).some(
        (m: { name: string }) => m.name === this.modelName || m.name.startsWith(prefix)
      )
      setCachedAvailability(key, available)
      return available
    } catch {
      setCachedAvailability(key, false)
      return false
    }
  }

  async *stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk> {
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    this.modelName,
        messages: allMessages,
        stream:   true,
        options: {
          num_predict: 2048,
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(55_000),
    })

    if (!res.ok || !res.body) {
      throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => '')}`)
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let   buf     = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.message?.content) yield { delta: parsed.message.content, done: false }
          if (parsed.done) { yield { delta: '', done: true }; return }
        } catch { /* skip malformed line */ }
      }
    }

    yield { delta: '', done: true }
  }
}

// ── 2. vLLM provider (OpenAI-compatible endpoint) ─────────────────────────
// vLLM exposes POST /v1/chat/completions with streaming.
// Set VLLM_BASE_URL=http://your-gpu-server:8000 to activate.
// Any model served by vLLM works here — llama3, mistral, mixtral, etc.

export class VLLMProvider implements IModelProvider {
  readonly providerType = 'vllm' as const
  readonly providerName = 'vllm'

  constructor(readonly modelName: string) {}

  private get baseUrl(): string {
    return process.env.VLLM_BASE_URL ?? 'http://localhost:8000'
  }

  async isAvailable(): Promise<boolean> {
    const key = `vllm:${this.modelName}`
    const cached = getCachedAvailability(key)
    if (cached !== null) return cached

    try {
      const res  = await fetch(`${this.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(3_000),
        headers: this.authHeaders(),
      })
      if (!res.ok) { setCachedAvailability(key, false); return false }
      const data = await res.json()
      const available = (data.data ?? []).some((m: { id: string }) => m.id === this.modelName)
      setCachedAvailability(key, available)
      return available
    } catch {
      setCachedAvailability(key, false)
      return false
    }
  }

  private authHeaders(): Record<string, string> {
    const token = process.env.VLLM_API_KEY
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async *stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk> {
    const payload = {
      model:    this.modelName,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream:   true,
      max_tokens: 2048,
      temperature: 0.7,
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(55_000),
    })

    if (!res.ok || !res.body) {
      throw new Error(`vLLM ${res.status}: ${await res.text().catch(() => '')}`)
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let   buf     = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const data = line.replace(/^data: /, '').trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta  = parsed.choices?.[0]?.delta?.content
          if (delta) yield { delta, done: false }
          if (parsed.choices?.[0]?.finish_reason) { yield { delta: '', done: true }; return }
        } catch { /* skip */ }
      }
    }

    yield { delta: '', done: true }
  }
}

// ── 3. Claude provider — optional, last-resort fallback ───────────────────
// Claude is only used when:
//   a) All local models are unavailable (Ollama down, no vLLM configured)
//   b) Explicitly configured as fallback via BIRDY_CLAUDE_FALLBACK=true
// Remove this class entirely once self-hosted infrastructure is stable.

export class ClaudeProvider implements IModelProvider {
  readonly providerType = 'anthropic' as const
  readonly providerName = 'claude'
  readonly modelName    = 'claude-sonnet-4-20250514'

  async isAvailable(): Promise<boolean> {
    const key = 'claude:sonnet'
    const cached = getCachedAvailability(key)
    if (cached !== null) return cached
    const available = !!process.env.ANTHROPIC_API_KEY &&
      process.env.BIRDY_CLAUDE_FALLBACK !== 'false'
    setCachedAvailability(key, available)
    return available
  }

  async *stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      yield { delta: '_[Birdy: no local model available and Claude API key not configured. Deploy Ollama or vLLM to enable self-hosted inference.]_', done: false }
      yield { delta: '', done: true }
      return
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client    = new Anthropic({ apiKey })

    try {
      const stream = client.messages.stream({
        model:      this.modelName,
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   messages.map(m => ({
          role:    m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: m.content,
        })),
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { delta: event.delta.text, done: false }
        }
      }
      yield { delta: '', done: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      yield { delta: `\n\n_Error: ${msg}_`, done: false }
      yield { delta: '', done: true }
    }
  }
}

// ── Provider instances ─────────────────────────────────────────────────────
// Instantiated once per process — no per-request overhead.

export const phi4Provider      = new OllamaProvider('phi4')
export const deepseekProvider  = new OllamaProvider('deepseek-coder-v2:16b')
export const qwen3Provider     = new OllamaProvider('qwen3:32b')
export const nomicProvider     = new OllamaProvider('nomic-embed-text')
export const claudeProvider    = new ClaudeProvider()

// vLLM providers — activated when VLLM_BASE_URL is set.
// Update model names to match whatever you're serving.
export const vllmLlama3Provider  = new VLLMProvider(process.env.VLLM_MODEL_REASONING ?? 'meta-llama/Llama-3.1-8B-Instruct')
export const vllmMistralProvider = new VLLMProvider(process.env.VLLM_MODEL_CODE      ?? 'mistralai/Mistral-7B-Instruct-v0.3')
