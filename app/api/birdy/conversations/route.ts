import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getConversations, createConversation } from '@/lib/birdy/sql'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const convs = await getConversations(session.user.id)
  return NextResponse.json({ conversations: convs.map(c => ({ id: c.id, title: c.title, module: c.module, updatedAt: c.updated_at, _count: { messages: Number(c.message_count) } })) })
}
