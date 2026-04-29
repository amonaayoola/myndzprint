/**
 * /api/claude — backwards-compatible server-side proxy.
 * Delegates to /api/llm; accepts optional provider+model in body.
 * Defaults to Anthropic/claude-haiku when not specified.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Forward everything to the unified /api/llm route
    const llmRes = await fetch(new URL('/api/llm', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: body.provider || 'anthropic',
        model: body.model,
        apiKey: body.apiKey,
        system: body.system,
        messages: body.messages,
        max_tokens: body.max_tokens,
      }),
    })

    const data = await llmRes.json()
    return NextResponse.json(data, { status: llmRes.status })
  } catch (err) {
    console.error('[/api/claude]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
