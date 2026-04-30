import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { type, rating, message, featureRequest, email } = await req.json()

    if (!message && !featureRequest) {
      return NextResponse.json({ error: 'Message or feature request required.' }, { status: 400 })
    }

    // Send to a Discord webhook if configured — instant notifications
    const webhookUrl = process.env.FEEDBACK_DISCORD_WEBHOOK
    if (webhookUrl) {
      const emoji = type === 'bug' ? 'X' : type === 'feature' ? 'bulb' : 'speech_balloon'
      const stars = rating ? 'star'.repeat(Math.min(rating, 5)) : ''
      const content = [
        `**[${type?.toUpperCase() || 'FEEDBACK'}]** :${emoji}: ${stars}`,
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

    // Also log to console so you can see it in Vercel/Railway logs
    console.log('[FEEDBACK]', JSON.stringify({ type, rating, message, featureRequest, email, ts: new Date().toISOString() }))

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
