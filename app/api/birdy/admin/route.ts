import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
  phi4Provider, deepseekProvider, qwen3Provider,
  claudeProvider, vllmLlama3Provider, vllmMistralProvider,
} from '@/lib/birdy/providers'
import { getPg } from '@/lib/db/postgres'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allProviders = [
    phi4Provider, deepseekProvider, qwen3Provider,
    vllmLlama3Provider, vllmMistralProvider, claudeProvider,
  ]

  // Probe all concurrently
  const [availabilities, usageStats, recentActivity] = await Promise.allSettled([
    Promise.all(allProviders.map(async p => ({
      providerName: p.providerName,
      providerType: p.providerType,
      modelName:    p.modelName,
      available:    await p.isAvailable(),
    }))),
    getUsageStats(getPg()),
    getRecentActivity(getPg(), session.user.id),
  ])

  const infrastructure = availabilities.status === 'fulfilled' ? availabilities.value : []
  const selfHostedCount = infrastructure.filter(p => p.available && p.providerType !== 'anthropic').length
  const claudeAvailable = infrastructure.find(p => p.providerName === 'claude')?.available ?? false

  return NextResponse.json({
    selfHostedStatus: {
      operational:     selfHostedCount > 0,
      modelsAvailable: selfHostedCount,
      claudeFallback:  claudeAvailable,
      autonomyScore:   selfHostedCount > 0 ? (claudeAvailable ? 'partial' : 'full') : 'none',
    },
    providers: infrastructure,
    routing: {
      strategy: 'ollama-first-cascade',
      chains: {
        strategic: ['qwen3:32b', 'phi4', '(claude: last resort)'],
        reasoning: ['qwen3:32b', 'phi4', '(claude: last resort)'],
        code:      ['deepseek-coder-v2:16b', 'qwen3:32b', 'phi4'],
        simple:    ['phi4', 'qwen3:32b'],
      },
    },
    usage: usageStats.status === 'fulfilled' ? usageStats.value : null,
    recentActivity: recentActivity.status === 'fulfilled' ? recentActivity.value : [],
    config: {
      ollamaUrl:     process.env.OLLAMA_BASE_URL ?? null,
      vllmUrl:       process.env.VLLM_BASE_URL   ?? null,
      claudeEnabled: !!process.env.ANTHROPIC_API_KEY &&
        process.env.BIRDY_CLAUDE_FALLBACK !== 'false',
    },
  })
}

async function getUsageStats(sql: ReturnType<typeof getPg>) {
  try {
    const rows = await sql`
      SELECT
        COUNT(*) AS total_requests,
        COALESCE(SUM(tokens_out), 0) AS total_tokens,
        COALESCE(AVG(latency_ms), 0) AS avg_latency_ms,
        COUNT(*) FILTER (WHERE status != 'claude-fallback') AS self_hosted_requests,
        COUNT(*) FILTER (WHERE status = 'claude-fallback') AS claude_requests
      FROM birdy_usage_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `
    const r = rows[0]
    return {
      last24h: {
        total:          Number(r.total_requests),
        selfHosted:     Number(r.self_hosted_requests),
        claudeFallback: Number(r.claude_requests),
        tokens:         Number(r.total_tokens),
        avgLatencyMs:   Math.round(Number(r.avg_latency_ms)),
        autonomyPct:    r.total_requests > 0
          ? Math.round((Number(r.self_hosted_requests) / Number(r.total_requests)) * 100)
          : 100,
      },
    }
  } catch { return null }
}

async function getRecentActivity(sql: ReturnType<typeof getPg>, userId: string) {
  try {
    return sql`
      SELECT provider, model, intent, tokens_out, latency_ms, status, created_at
      FROM birdy_usage_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 10
    `
  } catch { return [] }
}
