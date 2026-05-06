import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const apiKey = formData.get('apiKey') as string | null

    if (!file) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return NextResponse.json({ error: 'A valid OpenAI API key is required for voice transcription.' }, { status: 401 })
    }

    // Forward to OpenAI Whisper
    const whisperForm = new FormData()
    whisperForm.append('file', file, file.name)
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('response_format', 'text')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message || `Whisper API error ${res.status}`)
    }

    const text = await res.text()
    return NextResponse.json({ text: text.trim() })
  } catch (err: unknown) {
    console.error('[transcribe]', err)
    return NextResponse.json({ error: (err as Error).message || 'Transcription failed' }, { status: 500 })
  }
}
