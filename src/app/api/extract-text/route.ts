import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
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
