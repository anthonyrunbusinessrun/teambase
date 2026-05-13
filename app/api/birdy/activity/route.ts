import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getRecentActivity, getUsageStats } from '@/lib/birdy/sql'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [activity, stats] = await Promise.allSettled([
    getRecentActivity(session.user.id, 30),
    getUsageStats(session.user.id),
  ])
  return NextResponse.json({
    activity: activity.status === 'fulfilled' ? activity.value : [],
    stats:    stats.status    === 'fulfilled' ? stats.value    : null,
  })
}
