import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function fetchAllFeedback() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const res = await fetch(`${url}/rest/v1/feedback?order=created_at.desc&limit=10000`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
  })
  if (!res.ok) return null
  return res.json() as Promise<Record<string, unknown>[]>
}

function buildXlsx(rows: Record<string, unknown>[]): Buffer {
  const headers = ['ID', 'Timestamp', 'Type', 'Rating', 'Stars', 'Message', 'Feature Request', 'Email', 'User Agent']
  const colKeys = ['id', 'created_at', 'type', 'rating', 'stars', 'message', 'feature_request', 'email', 'user_agent']

  const escXml = (v: unknown): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const colLetter = (i: number) => String.fromCharCode(65 + i)

  const sharedStrings: string[] = []
  const ssIndex: Record<string, number> = {}
  const si = (val: string): number => {
    if (ssIndex[val] === undefined) { ssIndex[val] = sharedStrings.length; sharedStrings.push(val) }
    return ssIndex[val]
  }

  const allRows = [headers, ...rows.map(r => colKeys.map(k => {
    if (k === 'stars') return r['rating'] ? '★'.repeat(Number(r['rating'])) : ''
    if (k === 'created_at') {
      const d = r[k] ? new Date(String(r[k])) : null
      return d ? d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : ''
    }
    return String(r[k] ?? '')
  }))]

  const cellXml = (val: unknown, col: number, row: number): string => {
    const addr = `${colLetter(col)}${row}`
    const s = String(val ?? '')
    if (s === '') return `<c r="${addr}"/>`
    return `<c r="${addr}" t="s"><v>${si(s)}</v></c>`
  }

  const sheetData = allRows.map((row, ri) =>
    `<row r="${ri + 1}">${row.map((cell, ci) => cellXml(cell, ci, ri + 1)).join('')}</row>`
  ).join('')

  const widths: Record<string, number> = { ID: 6, Timestamp: 22, Type: 10, Rating: 8, Stars: 8, Message: 45, 'Feature Request': 35, Email: 28, 'User Agent': 30 }
  const cols = headers.map((h, i) => `<col min="${i+1}" max="${i+1}" width="${widths[h]||15}" customWidth="1"/>`).join('')

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/sheet">
<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols>
<sheetData>${sheetData}</sheetData>
<autoFilter ref="A1:${colLetter(headers.length-1)}1"/>
</worksheet>`

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/sheet" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')}
</sst>`

  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/sheet" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Feedback" sheetId="1" r:id="rId1"/></sheets></workbook>`

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deflateRawSync } = require('zlib')

  interface ZipEntry { name: string; data: Buffer }
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(pkgRels) },
    { name: 'xl/workbook.xml', data: Buffer.from(wbXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels) },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml) },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ssXml) },
  ]

  const parts: Buffer[] = []
  const centralDir: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name)
    const compressed = deflateRawSync(entry.data)
    const crc = crc32(entry.data)
    const now = dosDateTime()

    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8); local.writeUInt16LE(now.time, 10); local.writeUInt16LE(now.date, 12)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28); nameBytes.copy(local, 30)

    const cd = Buffer.alloc(46 + nameBytes.length)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(8, 10); cd.writeUInt16LE(now.time, 12); cd.writeUInt16LE(now.date, 14)
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(compressed.length, 20); cd.writeUInt32LE(entry.data.length, 24)
    cd.writeUInt16LE(nameBytes.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42)
    nameBytes.copy(cd, 46)

    parts.push(local, compressed); centralDir.push(cd)
    offset += local.length + compressed.length
  }

  const cdBuf = Buffer.concat(centralDir)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...parts, cdBuf, eocd])
}

function dosDateTime() {
  const d = new Date()
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }
}

let _crcTable: number[] | null = null
function crc32(buf: Buffer): number {
  if (!_crcTable) { _crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; _crcTable[n] = c } }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ _crcTable[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const adminToken = process.env.FEEDBACK_EXPORT_TOKEN
  if (adminToken && token !== adminToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 503 })
  }

  const rows = await fetchAllFeedback()
  if (!rows) return NextResponse.json({ error: 'Failed to fetch feedback.' }, { status: 500 })

  const xlsx = buildXlsx(rows)
  const filename = `myndzprint-feedback-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(xlsx, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(xlsx.length),
    },
  })
}
