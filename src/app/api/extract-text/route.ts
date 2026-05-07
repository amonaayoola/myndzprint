import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['txt', 'md', 'pdf', 'docx'])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Enforce file size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` }, { status: 413 })
    }

    // Validate extension against allowlist (prevent path traversal or unexpected types)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use TXT, PDF, or DOCX.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (ext === 'txt' || ext === 'md') {
      const text = buffer.toString('utf-8')
      return NextResponse.json({ text })
    }

    if (ext === 'pdf') {
      // Dynamic import so the cold-start cost is only paid when needed
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return NextResponse.json({ text: data.text })
    }

    if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return NextResponse.json({ text: result.value })
    }

    return NextResponse.json({ error: 'Unsupported file type. Use TXT, PDF, or DOCX.' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[extract-text]', err)
    return NextResponse.json({ error: (err as Error).message || 'Extraction failed' }, { status: 500 })
  }
}
