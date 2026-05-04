/**
 * embedder.ts
 *
 * Embedding backends, in priority order:
 *
 *  1. /api/embed server route  — uses OpenAI text-embedding-3-small (if apiKey set)
 *  2. Transformers.js          — all-MiniLM-L6-v2, runs in browser, ~25MB download
 *                                loaded lazily; hashEmbed used until ready
 *  3. hashEmbed                — FNV-1a char n-gram fallback, always available
 *
 * Turbopack note: dynamic import of @xenova/transformers works fine in production
 * (standard Next.js build). It crashes only under Turbopack dev mode. We guard
 * with process.env.NODE_ENV !== 'development' before attempting the import.
 */

// ── hashEmbed: fast offline fallback ────────────────────────────────────────
function hashEmbed(text: string): Float32Array {
  const vec = new Float32Array(384)
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const words = lower.split(/\s+/).filter(Boolean)
  for (const word of words) {
    for (let i = 0; i <= word.length - 3; i++) {
      const gram = word.slice(i, i + 3)
      let h = 2166136261
      for (let j = 0; j < gram.length; j++) {
        h ^= gram.charCodeAt(j)
        h = (h * 16777619) >>> 0
      }
      vec[h % 384] += 1
    }
    let hw = 2166136261
    for (let j = 0; j < word.length; j++) {
      hw ^= word.charCodeAt(j)
      hw = (hw * 16777619) >>> 0
    }
    vec[hw % 384] += 2
  }
  let norm = 0
  for (let i = 0; i < 384; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) + 1e-8
  for (let i = 0; i < 384; i++) vec[i] /= norm
  return vec
}

// ── Transformers.js pipeline (production only) ────────────────────────────
type Pipeline = (texts: string[], opts: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>

let _pipe: Pipeline | null = null
let _pipeLoading = false
let _pipeReady = false
let _pipeListeners: Array<() => void> = []

async function getPipeline(): Promise<Pipeline | null> {
  if (_pipeReady) return _pipe
  if (_pipeLoading) {
    // Wait for in-progress load
    return new Promise(resolve => {
      _pipeListeners.push(() => resolve(_pipe))
    })
  }

  // Only attempt in browser, only in production
  if (typeof window === 'undefined') return null
  if (process.env.NODE_ENV === 'development') return null

  _pipeLoading = true
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    // Use CDN-hosted ONNX models — no bundling needed
    env.allowLocalModels = false
    env.useBrowserCache = true
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    _pipe = pipe as unknown as Pipeline
    _pipeReady = true
  } catch (e) {
    console.warn('Transformers.js failed to load, using hashEmbed:', e)
    _pipe = null
    _pipeReady = true  // don't retry
  }
  _pipeLoading = false
  _pipeListeners.forEach(fn => fn())
  _pipeListeners = []
  return _pipe
}

async function embedWithTransformers(texts: string[]): Promise<Float32Array[] | null> {
  const pipe = await getPipeline()
  if (!pipe) return null
  try {
    const results: Float32Array[] = []
    // Process in batches of 8 to avoid OOM
    for (let i = 0; i < texts.length; i += 8) {
      const batch = texts.slice(i, i + 8)
      for (const text of batch) {
        const out = await pipe([text], { pooling: 'mean', normalize: true })
        results.push(new Float32Array(out.data))
      }
    }
    return results
  } catch (e) {
    console.warn('Transformers.js inference failed:', e)
    return null
  }
}

// ── /api/embed server route ───────────────────────────────────────────────
async function embedViaRoute(texts: string[], clientKey?: string): Promise<Float32Array[] | null> {
  try {
    const res = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, apiKey: clientKey }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.fallback) return null
    if (!data.embeddings) return null
    return (data.embeddings as number[][]).map(v => new Float32Array(v))
  } catch {
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────
export interface EmbedOptions {
  openAiKey?: string
}

export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<Float32Array[]> {
  // 1. Server route (OpenAI key)
  const serverResult = await embedViaRoute(texts, opts.openAiKey)
  if (serverResult) return serverResult

  // 2. Transformers.js (production semantic embeddings)
  const transformerResult = await embedWithTransformers(texts)
  if (transformerResult) return transformerResult

  // 3. hashEmbed fallback
  return texts.map(t => hashEmbed(t || ''))
}

export async function embedQuery(text: string, opts: EmbedOptions = {}): Promise<Float32Array> {
  const vecs = await embedTexts([text], opts)
  return vecs[0]
}

/**
 * Call this on app startup to begin loading the model in the background.
 * Queries will use hashEmbed until the model is ready, then automatically
 * switch to Transformers.js for all subsequent embeddings.
 */
export function preloadOfflineModel(): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV === 'development') return
  // Fire and forget — model loads in background
  getPipeline().catch(() => {})
}

export function isOfflineModelLoaded(): boolean {
  return _pipeReady && _pipe !== null
}
