/**
 * lib/birdy/sql.ts
 * Birdy database operations using TeamBase's raw postgres connection.
 * No Prisma — uses getPg() to stay compatible with the existing stack.
 */
import { getPg } from '@/lib/db/postgres'

// ── Table init (idempotent, called lazily) ────────────────────────────────

let tablesReady = false

export async function ensureBirdyTables(): Promise<void> {
  if (tablesReady) return
  const sql = getPg()
  await sql`
    CREATE TABLE IF NOT EXISTS birdy_conversations (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id     TEXT NOT NULL,
      title       TEXT,
      module      TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS birdy_conv_user ON birdy_conversations(user_id, updated_at DESC)`
  await sql`
    CREATE TABLE IF NOT EXISTS birdy_messages (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      conversation_id  TEXT NOT NULL REFERENCES birdy_conversations(id) ON DELETE CASCADE,
      role             TEXT NOT NULL CHECK (role IN ('USER','ASSISTANT')),
      content          TEXT NOT NULL,
      model_used       TEXT,
      provider         TEXT,
      action_key       TEXT,
      citations        JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS birdy_msg_conv ON birdy_messages(conversation_id, created_at ASC)`
  await sql`
    CREATE TABLE IF NOT EXISTS birdy_usage_logs (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id          TEXT NOT NULL,
      conversation_id  TEXT,
      provider         TEXT NOT NULL,
      model            TEXT NOT NULL,
      intent           TEXT,
      tokens_in        INT DEFAULT 0,
      tokens_out       INT DEFAULT 0,
      latency_ms       INT,
      rag_chunks_used  INT,
      status           TEXT DEFAULT 'success',
      page_module      TEXT,
      action_key       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS birdy_usage_user ON birdy_usage_logs(user_id, created_at DESC)`
  tablesReady = true
}

// ── Conversations ─────────────────────────────────────────────────────────

export async function getConversations(userId: string) {
  await ensureBirdyTables()
  const sql = getPg()
  return sql<Array<{ id: string; title: string | null; module: string | null; updated_at: string; message_count: string }>>`
    SELECT c.id, c.title, c.module, c.updated_at,
           COUNT(m.id) AS message_count
    FROM   birdy_conversations c
    LEFT JOIN birdy_messages m ON m.conversation_id = c.id
    WHERE  c.user_id = ${userId}
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 30
  `
}

export async function createConversation(userId: string, firstMessage?: string, module?: string) {
  await ensureBirdyTables()
  const sql = getPg()
  const title = firstMessage ? firstMessage.slice(0, 60).trim() + (firstMessage.length > 60 ? '…' : '') : 'New conversation'
  const rows = await sql<Array<{ id: string; title: string | null; created_at: string }>>`
    INSERT INTO birdy_conversations (user_id, title, module)
    VALUES (${userId}, ${title}, ${module ?? null})
    RETURNING id, title, created_at
  `
  return rows[0]
}

export async function getConversation(id: string, userId: string) {
  await ensureBirdyTables()
  const sql = getPg()
  const rows = await sql<Array<{ id: string; user_id: string }>>`
    SELECT id, user_id FROM birdy_conversations WHERE id = ${id} AND user_id = ${userId}
  `
  return rows[0] ?? null
}

export async function getMessages(conversationId: string, userId: string) {
  const conv = await getConversation(conversationId, userId)
  if (!conv) return null
  const sql = getPg()
  return sql<Array<{ id: string; role: string; content: string; model_used: string | null; action_key: string | null; citations: unknown; created_at: string }>>`
    SELECT id, role, content, model_used, action_key, citations, created_at
    FROM   birdy_messages WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC LIMIT 20
  `
}

export async function getMessageHistory(conversationId: string) {
  const sql = getPg()
  const rows = await sql<Array<{ role: string; content: string }>>`
    SELECT role, content FROM birdy_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC LIMIT 20
  `
  return rows.map(m => ({ role: m.role === 'USER' ? 'user' as const : 'assistant' as const, content: m.content }))
}

export async function saveMessage(data: {
  conversationId: string; role: 'USER' | 'ASSISTANT'; content: string
  modelUsed?: string; provider?: string; actionKey?: string; citations?: unknown; latencyMs?: number
}) {
  const sql = getPg()
  await sql`
    INSERT INTO birdy_messages (conversation_id, role, content, model_used, provider, action_key, citations)
    VALUES (${data.conversationId}, ${data.role}, ${data.content},
            ${data.modelUsed ?? null}, ${data.provider ?? null},
            ${data.actionKey ?? null}, ${data.citations ? JSON.stringify(data.citations) : null})
  `
  await sql`UPDATE birdy_conversations SET updated_at = NOW() WHERE id = ${data.conversationId}`
}

export async function logUsage(data: {
  userId: string; conversationId?: string; provider: string; model: string
  intent?: string; tokensOut?: number; latencyMs?: number
  ragChunksUsed?: number; status?: string; pageModule?: string; actionKey?: string
}) {
  try {
    const sql = getPg()
    await sql`
      INSERT INTO birdy_usage_logs
        (user_id, conversation_id, provider, model, intent, tokens_out, latency_ms, rag_chunks_used, status, page_module, action_key)
      VALUES
        (${data.userId}, ${data.conversationId ?? null}, ${data.provider}, ${data.model},
         ${data.intent ?? null}, ${data.tokensOut ?? 0}, ${data.latencyMs ?? null},
         ${data.ragChunksUsed ?? null}, ${data.status ?? 'success'}, ${data.pageModule ?? null}, ${data.actionKey ?? null})
    `
  } catch (err) { console.error('[birdy/sql] logUsage failed:', err) }
}

export async function getRecentActivity(userId: string, limit = 20) {
  await ensureBirdyTables()
  const sql = getPg()
  return sql<Array<{ id: string; provider: string; model: string; intent: string | null; tokens_out: number; latency_ms: number | null; rag_chunks_used: number | null; status: string; page_module: string | null; action_key: string | null; created_at: string }>>`
    SELECT id, provider, model, intent, tokens_out, latency_ms, rag_chunks_used, status, page_module, action_key, created_at
    FROM   birdy_usage_logs WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}
  `
}

export async function getUsageStats(userId: string) {
  await ensureBirdyTables()
  const sql = getPg()
  const rows = await sql<Array<{ total_requests: string; total_tokens_out: string; avg_latency_ms: string }>>`
    SELECT COUNT(*) AS total_requests,
           COALESCE(SUM(tokens_out),0) AS total_tokens_out,
           COALESCE(AVG(latency_ms),0) AS avg_latency_ms
    FROM birdy_usage_logs WHERE user_id = ${userId} AND status = 'success'
  `
  return {
    totalRequests:  Number(rows[0]?.total_requests ?? 0),
    totalTokensOut: Number(rows[0]?.total_tokens_out ?? 0),
    avgLatencyMs:   Math.round(Number(rows[0]?.avg_latency_ms ?? 0)),
  }
}
