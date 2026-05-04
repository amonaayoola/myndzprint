import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function insertFeedback(row: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const res = await fetch(`${url}/rest/v1/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(row),
  })
  return res.ok ? null : await res.text()
}

export async function POST(req: NextRequest) {
  try {
    const { type, rating, message, featureRequest, email } = await req.json()

    if (!message && !featureRequest) {
      return NextResponse.json({ error: 'Message or feature request required.' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') || ''
    const ts = new Date().toISOString()

    // ── Save to Supabase via REST API (no npm package needed) ─────────────────
    const dbErr = await insertFeedback({
      type: type || 'general',
      rating: rating || null,
      message: message || null,
      feature_request: featureRequest || null,
      email: email || null,
      user_agent: userAgent,
    })
    if (dbErr) console.warn('[FEEDBACK] Supabase error:', dbErr)

    // ── Discord webhook notification ──────────────────────────────────────────
    const webhookUrl = process.env.FEEDBACK_DISCORD_WEBHOOK
    if (webhookUrl) {
      const emoji = type === 'bug' ? 'X' : type === 'feature' ? 'bulb' : 'speech_balloon'
      const stars = rating ? '★'.repeat(Math.min(rating, 5)) : ''
      const content = [
        `**[${(type || 'FEEDBACK').toUpperCase()}]** :${emoji}: ${stars}`,
        message ? `> ${message}` : '',
        featureRequest ? `**Feature request:** ${featureRequest}` : '',
        email ? `**From:** ${email}` : '',
      ].filter(Boolean).join('\n')

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).catch(console.warn)
    }

    console.log('[FEEDBACK]', JSON.stringify({ type, rating, message, featureRequest, email, ts }))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
