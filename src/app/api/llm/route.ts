/**
 * /api/llm — unified multi-provider LLM proxy.
 * Accepts: { provider, apiKey, model, system, messages, max_tokens }
 * Returns:  { content: [{ text: string }] }  (normalized Anthropic-style response)
 *
 * Supported providers:
 *   'anthropic'  → api.anthropic.com/v1/messages
 *   'openai'     → api.openai.com/v1/chat/completions
 *   'openrouter' → openrouter.ai/api/v1/chat/completions
 */
import { NextRequest, NextResponse } from 'next/server'

type Provider = 'anthropic' | 'openai' | 'openrouter'

interface LLMRequest {
  provider?: Provider
  apiKey?: string
  model?: string
  system?: string
  messages: { role: string; content: string }[]
  max_tokens?: number
}

// Normalize an OpenAI-compatible response to Anthropic content format
function normalizeOpenAIResponse(data: Record<string, unknown>): { content: { text: string }[] } {
  const choices = data.choices as { message?: { content?: string } }[] | undefined
  const text = choices?.[0]?.message?.content ?? ''
  return { content: [{ text }] }
}

export async function POST(req: NextRequest) {
  try {
    const body: LLMRequest = await req.json()
    const { provider = 'anthropic', apiKey, model, system, messages, max_tokens = 500 } = body

    const key = (apiKey as string | undefined) || process.env.ANTHROPIC_KEY || ''
    if (!key) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 401 })
    }

    // ── Anthropic ──────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      const anthropicModel = model || 'claude-haiku-4-5-20251001'
      const anthropicBody: Record<string, unknown> = {
        model: anthropicModel,
        max_tokens,
        messages,
      }
      if (system) anthropicBody.system = system

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
      // Normalize Anthropic error messages so the client sees a clean string,
      // not a raw JSON blob (e.g. for 401 authentication_error).
      if (!res.ok) {
        const msg = (data as { error?: { message?: string } })?.error?.message || JSON.stringify(data)
        return NextResponse.json({ error: msg }, { status: res.status })
      }
      return NextResponse.json(data, { status: res.status })
    }

    // ── OpenAI ─────────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const openaiModel = model || 'gpt-4o-mini'
      const openaiMessages: { role: string; content: string }[] = []
      if (system) openaiMessages.push({ role: 'system', content: system })
      openaiMessages.push(...messages)

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: openaiMessages,
          max_tokens,
        }),
      })

      const data: Record<string, unknown> = await res.json()
      if (!res.ok) {
        return NextResponse.json(data, { status: res.status })
      }
      return NextResponse.json(normalizeOpenAIResponse(data))
    }

    // ── OpenRouter ─────────────────────────────────────────────────────────────
    if (provider === 'openrouter') {
      const orModel = model || 'google/gemma-3-27b-it'
      const orMessages: { role: string; content: string }[] = []
      if (system) orMessages.push({ role: 'system', content: system })
      orMessages.push(...messages)

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://myndzprint.com',
        },
        body: JSON.stringify({
          model: orModel,
          messages: orMessages,
          max_tokens,
        }),
      })

      const data: Record<string, unknown> = await res.json()
      if (!res.ok) {
        return NextResponse.json(data, { status: res.status })
      }
      return NextResponse.json(normalizeOpenAIResponse(data))
    }

    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  } catch (err) {
    console.error('[/api/llm]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
