/**
 * lib/birdy/router.ts
 * Ollama-first intelligent model router with priority cascade.
 *
 * PHILOSOPHY:
 *   Self-hosted models handle everything. Claude is an emergency fallback
 *   only — and is only used when ALL local models are unavailable.
 *   The system works fully offline with Ollama alone.
 *
 * ROUTING CHAINS (tried in order, first available wins):
 *
 *   strategic  → qwen3:32b → vLLM(reasoning) → phi4 → Claude (last resort)
 *   reasoning  → qwen3:32b → vLLM(reasoning) → phi4 → Claude (last resort)
 *   code       → deepseek-coder → vLLM(code) → qwen3 → phi4
 *   simple     → phi4 → qwen3 → vLLM(reasoning)
 *
 * INTENT CLASSIFICATION:
 *   Keyword + heuristic scoring. No external API call — runs synchronously.
 *   Future: replace with a local phi4 classifier prompt.
 */

import {
  IModelProvider,
  phi4Provider,
  deepseekProvider,
  qwen3Provider,
  claudeProvider,
  vllmLlama3Provider,
  vllmMistralProvider,
} from './providers'

export type Intent = 'simple' | 'code' | 'reasoning' | 'strategic'

export interface RoutingDecision {
  provider:       IModelProvider   // chosen provider (first available in chain)
  chain:          IModelProvider[] // full priority chain that was evaluated
  intent:         Intent
  reason:         string
  selfHosted:     boolean          // true if Claude was NOT used
}

// ── Intent classifier ──────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  code: [
    'code','function','bug','debug','implement','syntax','error','typescript',
    'javascript','python','sql','api','component','class','import','export',
    'const','async','await','react','prisma','query','database','migration',
    'script','fix','refactor','test','endpoint','schema','interface','type',
  ],
  strategic: [
    'strategy','plan','analyse','analyze','compare','evaluate','recommend',
    'decide','architecture','roadmap','priorities','business','market',
    'growth','forecast','budget','executive','board','quarterly','annually',
    'kpi','metrics','revenue','headcount','hiring plan',
  ],
  reasoning: [
    'explain','how','why','what','when','help me understand','describe',
    'difference','summarize','overview','breakdown','walk me through',
    'interview','candidate','draft','write','email','letter','document',
  ],
}

function classifyIntent(text: string, wordCount: number): Intent {
  const lower = text.toLowerCase()

  const codeScore     = SCORE_WEIGHTS.code.filter(t => lower.includes(t)).length
  const strategicScore = SCORE_WEIGHTS.strategic.filter(t => lower.includes(t)).length
  const reasoningScore = SCORE_WEIGHTS.reasoning.filter(t => lower.includes(t)).length

  // High code signal
  if (codeScore >= 2) return 'code'
  if (codeScore >= 1 && strategicScore === 0) return 'code'

  // Strategic: long message OR explicit strategic keywords
  if (wordCount > 150 || strategicScore >= 2) return 'strategic'
  if (strategicScore >= 1 && wordCount > 80) return 'strategic'

  // Reasoning: most conversational messages
  if (wordCount > 30 || reasoningScore >= 1) return 'reasoning'

  // Short utility
  return 'simple'
}

// ── Priority chains ────────────────────────────────────────────────────────

function buildChain(intent: Intent): IModelProvider[] {
  const hasVLLM   = !!process.env.VLLM_BASE_URL
  const hasClaude = !!process.env.ANTHROPIC_API_KEY &&
    process.env.BIRDY_CLAUDE_FALLBACK !== 'false'

  // Claude as last resort — only appended when key exists AND not disabled
  const claudeFallback = hasClaude ? [claudeProvider] : []

  switch (intent) {
    case 'strategic':
      return [
        qwen3Provider,
        ...(hasVLLM ? [vllmLlama3Provider] : []),
        phi4Provider,
        ...claudeFallback,
      ]

    case 'reasoning':
      return [
        qwen3Provider,
        ...(hasVLLM ? [vllmLlama3Provider] : []),
        phi4Provider,
        ...claudeFallback,
      ]

    case 'code':
      return [
        deepseekProvider,
        ...(hasVLLM ? [vllmMistralProvider] : []),
        qwen3Provider,
        phi4Provider,
        // No Claude in code chain — deepseek > Claude for code anyway
      ]

    case 'simple':
    default:
      return [
        phi4Provider,
        qwen3Provider,
        ...(hasVLLM ? [vllmLlama3Provider] : []),
        // No Claude in simple chain
      ]
  }
}

// ── Router ─────────────────────────────────────────────────────────────────

/**
 * routeMessage() — selects the best available provider for this message.
 *
 * Checks availability concurrently (all chain members probed in parallel)
 * then picks the first available in priority order.
 * Returns the full chain so callers can implement their own waterfall.
 */
export async function routeMessage(userMessage: string): Promise<RoutingDecision> {
  const wordCount = userMessage.trim().split(/\s+/).length
  const intent    = classifyIntent(userMessage, wordCount)
  const chain     = buildChain(intent)

  // Probe all providers in parallel — availability is cached 30s
  const available = await Promise.all(chain.map(p => p.isAvailable()))
  const provider  = chain.find((_, i) => available[i]) ?? chain[chain.length - 1]

  const selfHosted = provider.providerType !== 'anthropic'

  const reason = selfHosted
    ? `${intent} → ${provider.providerName}:${provider.modelName} (self-hosted)`
    : `${intent} → Claude fallback (no local model available)`

  return { provider, chain, intent, reason, selfHosted }
}

/**
 * Legacy sync version for compatibility during migration.
 * Uses phi4 as the universal self-hosted default when async resolution
 * isn't possible (e.g. in synchronous contexts).
 */
export function routeMessageSync(userMessage: string): RoutingDecision {
  const wordCount = userMessage.trim().split(/\s+/).length
  const intent    = classifyIntent(userMessage, wordCount)
  const chain     = buildChain(intent)
  const provider  = chain[0] // optimistic: assume first in chain is available

  return {
    provider,
    chain,
    intent,
    reason:     `${intent} → ${provider.modelName} (sync routing, availability not checked)`,
    selfHosted: provider.providerType !== 'anthropic',
  }
}
