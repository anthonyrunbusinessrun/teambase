/**
 * POST /api/birdy/admin/benchmark
 * Run evaluation suite against a specific model.
 * Returns streaming NDJSON results as each case completes.
 *
 * Body: { model: string, suite?: BenchmarkSuite, providerType?: 'ollama'|'vllm' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { OllamaProvider, VLLMProvider } from '@/lib/birdy/providers'
import { BENCHMARK_CASES, scoreOutput, type BenchmarkSuite } from '@/lib/birdy/eval/benchmarks'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 55

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { model?: string; suite?: BenchmarkSuite; providerType?: 'ollama' | 'vllm' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { model, suite, providerType = 'ollama' } = body
  if (!model) return NextResponse.json({ error: 'model required' }, { status: 400 })

  const provider = providerType === 'vllm'
    ? new VLLMProvider(model)
    : new OllamaProvider(model)

  const available = await provider.isAvailable()
  if (!available) {
    return NextResponse.json({ error: `Model ${model} not available via ${providerType}` }, { status: 503 })
  }

  const cases = suite ? BENCHMARK_CASES.filter(c => c.suite === suite) : BENCHMARK_CASES

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      const results = []

      for (const bcase of cases) {
        const t0 = Date.now()
        let output = ''

        try {
          for await (const chunk of provider.stream(
            [{ role: 'user', content: bcase.prompt }],
            'You are a professional enterprise AI assistant. Respond clearly and directly.'
          )) {
            if (chunk.delta) output += chunk.delta
            if (chunk.done) break
          }
        } catch (err) {
          output = `[ERROR: ${(err as Error).message}]`
        }

        const result = scoreOutput(bcase, output, Date.now() - t0, model, providerType)
        results.push(result)

        // Stream each result as NDJSON
        ctrl.enqueue(enc.encode(JSON.stringify({ type: 'result', data: result }) + '\n'))
      }

      // Final summary
      const avgScore   = results.reduce((s, r) => s + r.score, 0) / results.length
      const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length
      const passRate   = results.filter(r => r.passed).length / results.length

      ctrl.enqueue(enc.encode(JSON.stringify({
        type:    'summary',
        model,
        suite:   suite ?? 'all',
        cases:   results.length,
        avgScore:   Math.round(avgScore * 100) / 100,
        avgLatencyMs: Math.round(avgLatency),
        passRate:   Math.round(passRate * 100) / 100,
      }) + '\n'))

      ctrl.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
  })
}
