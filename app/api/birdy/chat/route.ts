import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/birdy/rate-limiter'
import { routeMessage } from '@/lib/birdy/router'
import { buildSystemPrompt, detectModule } from '@/lib/birdy/prompt'
import { createConversation, getConversation, getMessageHistory, saveMessage, logUsage } from '@/lib/birdy/sql'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 55

const inFlight = new Set<string>()
const enc      = new TextEncoder()
const sse      = (o: object) => enc.encode(`data: ${JSON.stringify(o)}\n\n`)

export async function POST(req: NextRequest) {
  // Auth
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  // Rate limit
  const rl = checkRateLimit(getRateLimitIdentifier(req), { limit: 10, windowMs: 60_000 })
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit reached.' }, { status: 429 })

  // Parse
  let body: { message?: unknown; conversationId?: unknown; pageModule?: unknown; actionKey?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { message, conversationId, pageModule, actionKey } = body
  if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const msg  = message.trim().slice(0, 16_000)
  const cid  = typeof conversationId === 'string' ? conversationId.trim() : null
  const mod  = typeof pageModule      === 'string' ? pageModule : '/'
  const akey = typeof actionKey       === 'string' ? actionKey  : undefined

  // Dedup
  const dedupKey = `${userId}:${cid ?? 'new'}:${msg.slice(0, 40)}`
  if (inFlight.has(dedupKey)) return NextResponse.json({ error: 'Already in progress' }, { status: 409 })
  inFlight.add(dedupKey)

  // Conversation
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

  // History + context
  const history = await getMessageHistory(convId).catch(() => [])
  const pageCtx = detectModule(mod)
  const systemPrompt = buildSystemPrompt({ pageContext: pageCtx })

  // Save user message
  await saveMessage({ conversationId: convId, role: 'USER', content: msg, actionKey: akey }).catch(console.error)

  // Route
  const routing = routeMessage(msg)
  const messagesForAI = [...history, { role: 'user' as const, content: msg }]
  let fullContent = ''
  const t0 = Date.now()

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => { try { ctrl.enqueue(sse(o)) } catch {} }
      send({ conversationId: convId, model: routing.provider.modelName, intent: routing.intent })

      const tryProvider = async (provider: typeof routing.provider) => {
        fullContent = ''
        for await (const chunk of provider.stream(messagesForAI, systemPrompt)) {
          if (chunk.error) throw new Error(chunk.error)
          if (chunk.delta) { fullContent += chunk.delta; send({ delta: chunk.delta }) }
          if (chunk.done) return
        }
      }

      let status: 'success' | 'error' | 'fallback' = 'success'
      try { await tryProvider(routing.provider) }
      catch {
        if (routing.fallback !== routing.provider) {
          status = 'fallback'
          try { await tryProvider(routing.fallback) }
          catch { status = 'error'; send({ error: 'AI unavailable', done: true }); ctrl.close(); inFlight.delete(dedupKey); return }
        } else { status = 'error'; send({ error: 'AI unavailable', done: true }); ctrl.close(); inFlight.delete(dedupKey); return }
      }

      const latencyMs = Date.now() - t0
      if (fullContent.trim()) {
        saveMessage({ conversationId: convId, role: 'ASSISTANT', content: fullContent, modelUsed: routing.provider.modelName, provider: routing.provider.providerName, actionKey: akey, latencyMs }).catch(console.error)
      }
      logUsage({ userId, conversationId: convId, provider: routing.provider.providerName, model: routing.provider.modelName, intent: routing.intent, tokensOut: Math.ceil(fullContent.length / 4), latencyMs, status, pageModule: mod, actionKey: akey }).catch(console.error)

      send({ done: true }); ctrl.close(); inFlight.delete(dedupKey)
    },
    cancel() { inFlight.delete(dedupKey) },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' } })
}
