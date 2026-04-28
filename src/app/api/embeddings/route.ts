/**
 * /api/embeddings — server-side proxy for OpenAI embeddings.
 * The OpenAI key never leaves the server.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { openAiKey, ...openAiBody } = body

    const key = (openAiKey as string | undefined) || process.env.OPENAI_KEY || ''
    if (!key) {
      return NextResponse.json({ error: 'No OpenAI API key configured' }, { status: 401 })
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(openAiBody),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[/api/embeddings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
