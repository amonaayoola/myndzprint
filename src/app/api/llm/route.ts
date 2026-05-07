import { NextRequest, NextResponse } from 'next/server'

// Node.js runtime: no 25s edge timeout, supports longer LLM responses
export const runtime = 'nodejs'
export const maxDuration = 60  // seconds — covers slow models and long replies

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { system, messages, max_tokens = 300, provider = 'anthropic', model, stream = false } = body

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      const apiKey =
        process.env.ANTHROPIC_API_KEY ||
        process.env.NEXT_PUBLIC_ANTHROPIC_KEY ||
        body.apiKey

      if (!apiKey) {
        return NextResponse.json({ error: { message: 'No Anthropic API key configured.' } }, { status: 401 })
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens,
          system,
          messages,
          stream,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        return NextResponse.json(err, { status: res.status })
      }

      if (stream) {
        // Pass streaming response directly to client
        return new Response(res.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      return NextResponse.json(await res.json())
    }

    // ── OpenAI ────────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const apiKey =
        process.env.OPENAI_API_KEY ||
        process.env.NEXT_PUBLIC_OPENAI_KEY ||
        body.apiKey

      if (!apiKey) {
        return NextResponse.json({ error: { message: 'No OpenAI API key configured.' } }, { status: 401 })
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          max_tokens,
          stream,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            ...messages,
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        return NextResponse.json(err, { status: res.status })
      }

      if (stream) {
        return new Response(res.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ content: [{ text }] })
    }

    // ── OpenRouter ────────────────────────────────────────────────────────────
    if (provider === 'openrouter') {
      const apiKey =
        process.env.OPENROUTER_API_KEY ||
        body.apiKey

      if (!apiKey) {
        return NextResponse.json({ error: { message: 'No OpenRouter API key configured.' } }, { status: 401 })
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://myndzprint.vercel.app',
          'X-Title': 'Myndzprint',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-4o-mini',
          max_tokens,
          stream,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            ...messages,
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        return NextResponse.json(err, { status: res.status })
      }

      if (stream) {
        return new Response(res.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ content: [{ text }] })
    }

    return NextResponse.json({ error: { message: `Unknown provider: ${provider}` } }, { status: 400 })
  } catch (err) {
    console.error('[/api/llm]', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
