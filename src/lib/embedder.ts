/**
 * embedder.ts
 * Two backends:
 *   Offline: all-MiniLM-L6-v2 via Transformers.js (runs entirely in browser)
 *   API:     OpenAI text-embedding-3-small (requires key)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null
let _loading = false
const _loadCallbacks: Array<() => void> = []

async function getOfflinePipeline() {
  if (_pipeline) return _pipeline
  if (_loading) {
    await new Promise<void>(res => _loadCallbacks.push(res))
    return _pipeline
  }
  _loading = true
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  } finally {
    _loading = false
    _loadCallbacks.forEach(cb => cb())
    _loadCallbacks.length = 0
  }
  return _pipeline
}

async function embedOffline(texts: string[]): Promise<number[][]> {
  const pipe = await getOfflinePipeline()
  const results: number[][] = []
  for (const t of texts) {
    const out = await pipe(t, { pooling: 'mean', normalize: true })
    // out.data is a Float32Array
    results.push(Array.from(out.data as Float32Array))
  }
  return results
}

async function embedOpenAI(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  })
  if (!res.ok) throw new Error(`OpenAI embed error ${res.status}`)
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

export interface EmbedOptions {
  openAiKey?: string
}

export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<number[][]> {
  if (opts.openAiKey) {
    try { return await embedOpenAI(texts, opts.openAiKey) } catch { /* fallback */ }
  }
  return embedOffline(texts)
}

export async function embedQuery(text: string, opts: EmbedOptions = {}): Promise<number[]> {
  const vecs = await embedTexts([text], opts)
  return vecs[0]
}

export function preloadOfflineModel(): void {
  if (typeof window === 'undefined') return
  getOfflinePipeline().catch(() => {})
}

export function isOfflineModelLoaded(): boolean {
  return _pipeline !== null
}
