/**
 * lib/birdy/router.ts
 * Intelligent model router with graceful degradation.
 *
 * ROUTING TABLE:
 *   simple / short       → phi4          (Ollama, fast utility)
 *   coding / technical   → deepseek-coder (Ollama, code-optimised)
 *   reasoning / explain  → qwen3          (Ollama, strong reasoning)
 *   complex / strategic  → Claude         (always-available fallback)
 *
 * DEGRADED MODE:
 *   When Ollama models are not yet available (first boot, model still pulling),
 *   all Ollama routes fall back to Claude transparently.
 *   The fallback field in RoutingDecision is always Claude.
 */

import {
  IModelProvider,
  claudeProvider,
  phi4Provider,
  deepseekProvider,
  qwen3Provider,
} from './providers'

const CODE_TOKENS = [
  'code','function','bug','debug','implement','syntax','error',
  'typescript','javascript','python','sql','api','component',
  'class','import','export','const','async','await','react',
  'prisma','query','database','migration','script','fix',
]

const STRATEGIC_TOKENS = [
  'strategy','plan','analyse','analyze','compare','evaluate',
  'recommend','decide','architecture','roadmap','priorities',
  'business','market','growth','forecast','budget',
]

export type Intent = 'simple' | 'code' | 'reasoning' | 'strategic'

export interface RoutingDecision {
  provider: IModelProvider
  intent:   Intent
  reason:   string
  fallback: IModelProvider
}

export function routeMessage(userMessage: string): RoutingDecision {
  const text      = userMessage.toLowerCase()
  const wordCount = text.split(/\s+/).length
  const ollamaUrl = process.env.OLLAMA_BASE_URL

  // If Ollama not configured: all traffic → Claude
  if (!ollamaUrl) {
    return { provider: claudeProvider, intent: 'strategic', reason: 'Ollama not configured → Claude', fallback: claudeProvider }
  }

  if (wordCount > 200 || STRATEGIC_TOKENS.some(t => text.includes(t))) {
    return { provider: claudeProvider, intent: 'strategic', reason: 'Complex/strategic → Claude', fallback: claudeProvider }
  }

  if (CODE_TOKENS.some(t => text.includes(t))) {
    return { provider: deepseekProvider, intent: 'code', reason: 'Code task → deepseek-coder', fallback: claudeProvider }
  }

  if (wordCount > 50 || ['explain','how','why','what','when'].some(t => text.includes(t))) {
    return { provider: qwen3Provider, intent: 'reasoning', reason: 'Reasoning → qwen3', fallback: claudeProvider }
  }

  return { provider: phi4Provider, intent: 'simple', reason: 'Short/simple → phi4', fallback: claudeProvider }
}
