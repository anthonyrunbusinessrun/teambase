import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/birdy/rate-limiter'
import { routeMessage } from '@/lib/birdy/router'
import { buildSystemPrompt, detectModule } from '@/lib/birdy/prompt'
import {
  createConversation, getConversation, getMessageHistory,
  saveMessage, logUsage
} from '@/lib/birdy/sql'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 55

const inFlight = new Set<string>()
const enc      = new TextEncoder()
const sse      = (o: object) => enc.encode(`data: ${JSON.stringify(o)}\n\n`)

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const rl = checkRateLimit(getRateLimitIdentifier(req), { limit: 15, windowMs: 60_000 })
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit reached.' }, { status: 429 })

  let body: { message?: unknown; conversationId?: unknown; pageModule?: unknown; actionKey?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { message, conversationId, pageModule, actionKey } = body
  if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const msg  = message.trim().slice(0, 16_000)
  const cid  = typeof conversationId === 'string' ? conversationId.trim() : null
  const mod  = typeof pageModule === 'string' ? pageModule : '/'
  const akey = typeof actionKey  === 'string' ? actionKey  : undefined

  const dedupKey = `${userId}:${cid ?? 'new'}:${msg.slice(0, 40)}`
  if (inFlight.has(dedupKey)) return NextResponse.json({ error: 'Already in progress' }, { status: 409 })
  inFlight.add(dedupKey)

  let convId: string
  try {
    if (!cid) {
      const conv = await createConversation(userId, msg, mod)
      convId = conv.id
    } else {
      const conv = await getConversation(cid, userId)
      if (!conv) { inFlight.delete(dedupKey); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }
      convId = cid
    }
  } catch { inFlight.delete(dedupKey); return NextResponse.json({ error: 'DB error' }, { status: 503 }) }

  // Parallel: history + routing (routing probes Ollama/vLLM health concurrently)
  const [history, routing] = await Promise.all([
    getMessageHistory(convId).catch(() => []),
    routeMessage(msg),
  ])

  const pageCtx    = detectModule(mod)
  const systemPrompt = buildSystemPrompt({ pageContext: pageCtx })

  await saveMessage({ conversationId: convId, role: 'USER', content: msg, actionKey: akey }).catch(console.error)

  const messagesForAI = [...history, { role: 'user' as const, content: msg }]
  let   fullContent   = ''
  const t0            = Date.now()

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => { try { ctrl.enqueue(sse(o)) } catch {} }

      send({
        conversationId: convId,
        model:          routing.provider.modelName,
        provider:       routing.provider.providerName,
        intent:         routing.intent,
        selfHosted:     routing.selfHosted,
      })

      // Walk the priority chain — try each provider until one succeeds
      let succeeded = false
      let usedProvider = routing.provider

      for (const provider of routing.chain) {
        if (!(await provider.isAvailable())) continue
        fullContent = ''
        try {
          for await (const chunk of provider.stream(messagesForAI, systemPrompt)) {
            if (chunk.error) throw new Error(chunk.error)
            if (chunk.delta) { fullContent += chunk.delta; send({ delta: chunk.delta }) }
            if (chunk.done) { succeeded = true; usedProvider = provider; break }
          }
          if (succeeded) break
        } catch (err) {
          // Provider failed mid-stream — try next
          console.warn(`[birdy/chat] ${provider.modelName} failed, trying next:`, (err as Error).message)
          fullContent = ''
          continue
        }
      }

      if (!succeeded) {
        send({ error: 'All AI providers are currently unavailable. Please check Ollama is running and models are pulled.', done: true })
        ctrl.close(); inFlight.delete(dedupKey); return
      }

      const latencyMs   = Date.now() - t0
      const selfHosted  = usedProvider.providerType !== 'anthropic'

      if (fullContent.trim()) {
        saveMessage({
          conversationId: convId, role: 'ASSISTANT', content: fullContent,
          modelUsed: usedProvider.modelName, provider: usedProvider.providerName,
          actionKey: akey, latencyMs,
        }).catch(console.error)
      }

      logUsage({
        userId, conversationId: convId,
        provider:  usedProvider.providerName,
        model:     usedProvider.modelName,
        intent:    routing.intent,
        tokensOut: Math.ceil(fullContent.length / 4),
        latencyMs,
        status:    selfHosted ? 'success' : 'claude-fallback',
        pageModule: mod, actionKey: akey,
      }).catch(console.error)

      send({ done: true, selfHosted })
      ctrl.close(); inFlight.delete(dedupKey)
    },
    cancel() { inFlight.delete(dedupKey) },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-store',
      'X-Accel-Buffering': 'no',
      'Connection':        'keep-alive',
    },
  })
}
