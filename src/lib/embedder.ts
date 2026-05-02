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

// ── Lightweight keyword hash fallback ────────────────────────────────────────
// Turbopack (Next.js dev) crashes when dynamically importing @xenova/transformers
// with "Cannot convert undefined or null to object" at Object.keys.
// We skip Transformers.js entirely and always use this hash embedder in the browser.
// It produces a sparse 384-dim vector via character n-gram hashing — lower quality
// than MiniLM but indexing always completes and similarity search works well for
// high-keyword-overlap queries. Production deployments should use the /api/embed
// server route with an OpenAI key for full-quality embeddings.
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
  // Always use hashEmbed in the browser — Transformers.js dynamic imports
  // crash under Turbopack and add 23MB of WASM overhead even when they work.
  // The /api/embed server route (with OPENAI_API_KEY) is the production path
  // for full-quality embeddings. hashEmbed is good enough for local offline use.
  return texts.map(t => hashEmbed(t || ''))
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
  // No-op: Transformers.js removed from browser path (Turbopack incompatible).
  // Embeddings use hashEmbed offline or /api/embed server route with OpenAI key.
}

export function isOfflineModelLoaded(): boolean {
  return false
}
