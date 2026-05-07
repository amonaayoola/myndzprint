import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_AUDIO_SIZE_MB = 25 // Whisper API limit is 25MB
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set(['mp3', 'mpeg', 'mp4', 'm4a', 'wav', 'webm', 'ogg'])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const apiKey = formData.get('apiKey') as string | null

    if (!file) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })

    // Validate key format only — never log it
    if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 20) {
      return NextResponse.json({ error: 'A valid OpenAI API key is required for voice transcription.' }, { status: 401 })
    }

    // Enforce audio file size limit
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json({ error: `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB.` }, { status: 413 })
    }

    // Validate MIME type against allowlist
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_AUDIO_TYPES.has(ext)) {
      return NextResponse.json({ error: 'Unsupported audio format. Use MP3, M4A, WAV, or WEBM.' }, { status: 400 })
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
