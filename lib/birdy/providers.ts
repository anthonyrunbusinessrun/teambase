/**
 * AI provider abstraction — Claude + Ollama.
 * Both implement the same interface so the router can swap them transparently.
 */

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChunk {
  delta: string
  done: boolean
  error?: string
}

export interface CompletionResult {
  content: string
  tokensIn: number
  tokensOut: number
  model: string
  provider: string
  latencyMs: number
}

export interface IModelProvider {
  readonly providerName: string
  readonly modelName: string
  stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk>
}

// ── Claude provider ─────────────────────────────────────────────────────────

export class ClaudeProvider implements IModelProvider {
  readonly providerName = 'claude'
  readonly modelName = 'claude-sonnet-4-20250514'

  async *stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      yield { delta: '⚠️ Birdy is not configured yet. Please set `ANTHROPIC_API_KEY` in Railway environment variables.', done: false }
      yield { delta: '', done: true }
      return
    }

    // Use Anthropic SDK (imported dynamically to support edge-adjacent Next.js)
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })

    try {
      const stream = client.messages.stream({
        model: this.modelName,
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: m.content,
        })),
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { delta: event.delta.text, done: false }
        }
      }

      yield { delta: '', done: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      yield { delta: `\n\n_Error: ${msg}_`, done: false }
      yield { delta: '', done: true }
    }
  }
}

// ── Ollama provider ─────────────────────────────────────────────────────────

export class OllamaProvider implements IModelProvider {
  readonly providerName = 'ollama'

  constructor(readonly modelName: string) {}

  private get baseUrl(): string {
    return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  }

  async *stream(messages: ModelMessage[], systemPrompt: string): AsyncGenerator<StreamChunk> {
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: allMessages,
          stream: true,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Ollama ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

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
            if (parsed.message?.content) {
              yield { delta: parsed.message.content, done: false }
            }
            if (parsed.done) {
              yield { delta: '', done: true }
              return
            }
          } catch { /* skip */ }
        }
      }

      yield { delta: '', done: true }
    } catch {
      // Ollama unavailable — caller will fallback to Claude
      throw new Error('Ollama unavailable')
    }
  }
}

// ── Provider instances (module-level singletons) ────────────────────────────

export const claudeProvider = new ClaudeProvider()
export const phi4Provider = new OllamaProvider('phi4')
export const deepseekProvider = new OllamaProvider('deepseek-coder-v2:16b')
export const qwen3Provider = new OllamaProvider('qwen3:32b')
