/**
 * embedder.ts
 *
 * Two backends behind one interface:
 *   Server route:  /api/embed  (uses OPENAI_API_KEY from server env)
 *   Offline:       all-MiniLM-L6-v2 via Transformers.js (runs in browser)
 *
 * Turbopack-safe: handles the case where @xenova/transformers returns
 * undefined/null or wraps exports in a .default object.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null
let _loading = false
let _failed = false
const _loadCallbacks: Array<() => void> = []

async function getOfflinePipeline() {
  if (_pipeline) return _pipeline
  if (_failed) throw new Error('Offline pipeline previously failed to load')
  if (_loading) {
    await new Promise<void>(res => _loadCallbacks.push(res))
    if (_failed) throw new Error('Offline pipeline failed to load')
    return _pipeline
  }

  _loading = true
  try {
    // Turbopack / webpack may wrap the module differently — handle both
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mod: any = await import('@xenova/transformers')

    // Some bundlers wrap in .default
    if (mod && mod.default && typeof mod.default.pipeline === 'function') {
      mod = mod.default
    }

    if (!mod || typeof mod.pipeline !== 'function') {
      throw new Error('Transformers.js did not export a pipeline function')
    }

    const { pipeline, env } = mod
    if (env) {
      env.allowLocalModels = false
      env.useBrowserCache = true
    }

    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

    if (!_pipeline) {
      throw new Error('pipeline() returned null/undefined')
    }
  } catch (e) {
    _failed = true
    console.error('Offline pipeline initialization failed:', e)
    throw e
  } finally {
    _loading = false
    _loadCallbacks.forEach(cb => cb())
    _loadCallbacks.length = 0
  }

  return _pipeline
}

// ── Lightweight keyword hash fallback ────────────────────────────────────────
// Used when Transformers.js fails to load (e.g. Turbopack dev mode).
// Produces a sparse 384-dim vector based on character n-gram hashing.
// Quality is lower than MiniLM but indexing always completes and
// similarity search still works for high-keyword-overlap queries.
function hashEmbed(text: string): Float32Array {
  const vec = new Float32Array(384)
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const words = lower.split(/\s+/).filter(Boolean)
  for (const word of words) {
    // 3-gram character hashing into the vector space
    for (let i = 0; i <= word.length - 3; i++) {
      const gram = word.slice(i, i + 3)
      let h = 2166136261
      for (let j = 0; j < gram.length; j++) {
        h ^= gram.charCodeAt(j)
        h = (h * 16777619) >>> 0
      }
      vec[h % 384] += 1
    }
    // Also hash full word
    let hw = 2166136261
    for (let j = 0; j < word.length; j++) {
      hw ^= word.charCodeAt(j)
      hw = (hw * 16777619) >>> 0
    }
    vec[hw % 384] += 2
  }
  // L2 normalize
  let norm = 0
  for (let i = 0; i < 384; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) + 1e-8
  for (let i = 0; i < 384; i++) vec[i] /= norm
  return vec
}

async function embedOffline(texts: string[]): Promise<Float32Array[]> {
  // Under Turbopack (Next.js dev), @xenova/transformers dynamic imports crash
  // with "Cannot convert undefined or null to object" at Object.keys.
  // Skip the pipeline entirely in dev and use hashEmbed which always works.
  // In production (webpack build), Transformers.js loads fine.
  if (process.env.NODE_ENV === 'development') {
    return texts.map(t => hashEmbed(t || ''))
  }
  try {
    const pipe = await getOfflinePipeline()
    const results: Float32Array[] = []
    for (const t of texts) {
      if (!t) { results.push(new Float32Array(384)); continue }
      const out = await pipe(t, { pooling: 'mean', normalize: true })
      results.push(out.data instanceof Float32Array ? out.data : new Float32Array(out.data))
    }
    return results
  } catch {
    // Transformers.js unavailable — fall back to keyword hash embeddings
    console.warn('Transformers.js unavailable — using keyword hash embeddings. Add OPENAI_API_KEY to .env.local for full quality.')
    return texts.map(t => hashEmbed(t || ''))
  }
}

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

export interface EmbedOptions {
  openAiKey?: string
}

export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<Float32Array[]> {
  // Try server route first (keeps API keys off browser)
  const serverResult = await embedViaRoute(texts, opts.openAiKey)
  if (serverResult) return serverResult
  // Fall back to in-browser Transformers.js
  return embedOffline(texts)
}

export async function embedQuery(text: string, opts: EmbedOptions = {}): Promise<Float32Array> {
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
