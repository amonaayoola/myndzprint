/**
 * /api/claude — server-side proxy for all Anthropic API calls.
 * The API key never leaves the server; clients send requests here.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { apiKey, ...anthropicBody } = body

    const key = (apiKey as string | undefined) || process.env.ANTHROPIC_KEY || ''
    if (!key) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 401 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[/api/claude]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
