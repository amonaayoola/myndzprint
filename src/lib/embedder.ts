/**
 * embedder.ts
 * Two backends:
 *   Offline: all-MiniLM-L6-v2 via Transformers.js (runs entirely in browser)
 *   API:     OpenAI text-embedding-3-small via /api/embeddings server-side proxy
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null
let _loading = false
// Bug #5 fix: callbacks hold both resolve AND reject so a failed load rejects waiters
const _loadCallbacks: Array<{ resolve: () => void; reject: (e: Error) => void }> = []

async function getOfflinePipeline() {
  if (_pipeline) return _pipeline
  if (_loading) {
    await new Promise<void>((resolve, reject) => _loadCallbacks.push({ resolve, reject }))
    if (!_pipeline) throw new Error('Offline model failed to load')
    return _pipeline
  }
  _loading = true
  let loadError: Error | null = null
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err))
  } finally {
    _loading = false
    if (loadError) {
      // Bug #5 fix: reject all pending callbacks with Error instead of resolving with null
      _loadCallbacks.forEach(cb => cb.reject(loadError!))
    } else {
      _loadCallbacks.forEach(cb => cb.resolve())
    }
    _loadCallbacks.length = 0
  }
  if (loadError) throw loadError
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

// Bug #4 fix: proxy OpenAI embeddings through server-side /api/embeddings route
async function embedViaProxy(texts: string[]): Promise<number[][]> {
  const res = await fetch('/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  })
  if (!res.ok) throw new Error(`Embedding proxy error ${res.status}`)
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

export interface EmbedOptions {
  // openAiKey is no longer used client-side; kept for interface compat
  openAiKey?: string
}

export async function embedTexts(texts: string[], _opts: EmbedOptions = {}): Promise<number[][]> {
  // Try server-side proxy first (uses OPENAI_KEY env var on server)
  try { return await embedViaProxy(texts) } catch { /* fall through to offline */ }
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
