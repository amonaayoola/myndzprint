import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function sbHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } }
}

// Allowlist of valid event names — prevents arbitrary strings being stored
const VALID_EVENTS = new Set([
  'page_visit', 'signup', 'login', 'logout',
  'mind_open', 'message_sent', 'mind_created', 'mind_published',
  'build_modal_open', 'file_upload', 'voice_upload',
])

// POST — track an event (fire-and-forget from client)
export async function POST(req: NextRequest) {
  try {
    const { event, mindId, userEmail, metadata } = await req.json()
    if (!event) return NextResponse.json({ error: 'event required' }, { status: 400 })

    // Reject unknown event names to prevent log pollution / injection
    if (!VALID_EVENTS.has(event)) {
      return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    }

    // Sanitise strings — truncate to reasonable lengths
    const safeEvent = String(event).slice(0, 64)
    const safeMindId = mindId ? String(mindId).slice(0, 128) : null
    const safeEmail = userEmail ? String(userEmail).slice(0, 254) : null
    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : null

    const sb = sbHeaders()
    if (sb) {
      await fetch(`${sb.url}/rest/v1/events`, {
        method: 'POST',
        headers: { ...sb.headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          event: safeEvent,
          mind_id: safeMindId,
          user_email: safeEmail,
          metadata: safeMetadata,
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    // Don't leak internal error details on analytics route
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET — return aggregated stats (admin only)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (process.env.FEEDBACK_EXPORT_TOKEN && token !== process.env.FEEDBACK_EXPORT_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = sbHeaders()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  // Fetch all events (up to 50k rows — enough for early stage)
  const res = await fetch(`${sb.url}/rest/v1/events?select=event,mind_id,user_email,created_at&limit=50000&order=created_at.desc`, {
    headers: sb.headers,
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  const events: { event: string; mind_id: string | null; user_email: string | null; created_at: string }[] = await res.json()

  // Aggregate
  const countBy = (key: string) => {
    const map: Record<string, number> = {}
    for (const e of events) {
      const v = (e as Record<string, unknown>)[key] as string
      if (v) map[v] = (map[v] || 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  const byEvent = countBy('event')
  const total = (name: string) => byEvent.find(([k]) => k === name)?.[1] || 0

  // Unique users (by email, excluding nulls)
  const uniqueUsers = new Set(events.filter(e => e.user_email).map(e => e.user_email)).size

  // Messages per mind
  const chatEvents = events.filter(e => e.event === 'message_sent')
  const mindCounts: Record<string, number> = {}
  for (const e of chatEvents) {
    if (e.mind_id) mindCounts[e.mind_id] = (mindCounts[e.mind_id] || 0) + 1
  }
  const mindsRanked = Object.entries(mindCounts).sort((a, b) => b[1] - a[1])

  // Daily visits (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const dailyVisits: Record<string, number> = {}
  for (const e of events) {
    if (e.event === 'page_visit' && new Date(e.created_at) > thirtyDaysAgo) {
      const day = e.created_at.slice(0, 10)
      dailyVisits[day] = (dailyVisits[day] || 0) + 1
    }
  }

  return NextResponse.json({
    totalEvents: events.length,
    uniqueUsers,
    pageVisits: total('page_visit'),
    signups: total('signup'),
    logins: total('login'),
    totalChats: total('message_sent'),
    mindOpens: total('mind_open'),
    mindsCreated: total('mind_created'),
    mindsRanked,
    dailyVisits: Object.entries(dailyVisits).sort(),
    byEvent,
  })
}
