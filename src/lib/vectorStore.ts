/**
 * vectorStore.ts
 *
 * Persists embedding vectors in IndexedDB with label metadata for
 * TagRAG-style filtered retrieval. Includes an in-memory chunk cache
 * so repeated messages against the same mind skip IndexedDB reads.
 *
 * Falls back to an in-memory NullStore when IndexedDB is unavailable
 * (private browsing, Brave shields, Safari ITP, storage quota exceeded).
 */
import { openDB, type IDBPDatabase } from 'idb'
const RAG = { TOP_K: 6, MIN_SCORE: 0.25 }

export interface VectorChunk {
  id: string
  mindId: string
  text: string
  vector: Float32Array
  topicLabel: string
  registerLabel: string
  sourceType: 'corpus' | 'brain'
}

// ── In-memory fallback store ──────────────────────────────────────────────────
const memoryStore = new Map<string, VectorChunk>()
let useMemoryFallback = false

// ── Active-mind chunk cache (avoids repeated IndexedDB reads) ─────────────────
let _cacheKey: string | null = null
let _cache: VectorChunk[] = []

function invalidateCache(mindId?: string) {
  if (!mindId || _cacheKey === mindId) {
    _cacheKey = null
    _cache = []
  }
}

// ── IndexedDB store ───────────────────────────────────────────────────────────
const DB_NAME = 'myndzprint-vectors'
const STORE = 'chunks'
const VERSION = 2   // bumped for label columns

let _db: IDBPDatabase | null = null

async function db(): Promise<IDBPDatabase> {
  if (_db) return _db
  try {
    _db = await openDB(DB_NAME, VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        let store
        if (oldVersion < 1) {
          store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('mindId', 'mindId')
        } else {
          store = transaction.objectStore(STORE)
        }
        if (oldVersion < 2) {
          // v2: add topicLabel and sourceType indexes for TagRAG filtered retrieval
          if (!store.indexNames.contains('topicLabel')) store.createIndex('topicLabel', 'topicLabel')
          if (!store.indexNames.contains('sourceType')) store.createIndex('sourceType', 'sourceType')
        }
      },
    })
    return _db
  } catch (err) {
    useMemoryFallback = true
    throw new Error(`IndexedDB unavailable, using memory fallback: ${err}`)
  }
}

function toStorable(chunk: VectorChunk): object {
  return {
    ...chunk,
    vector: Array.from(chunk.vector),
    topicLabel: chunk.topicLabel || 'general',
    registerLabel: chunk.registerLabel || 'balanced',
    sourceType: chunk.sourceType || 'corpus',
  }
}

function fromStorable(raw: Record<string, unknown>): VectorChunk {
  return {
    id: raw.id as string,
    mindId: raw.mindId as string,
    text: raw.text as string,
    vector: raw.vector instanceof Float32Array ? raw.vector : new Float32Array(raw.vector as number[]),
    topicLabel: (raw.topicLabel as string) || 'general',
    registerLabel: (raw.registerLabel as string) || 'balanced',
    sourceType: (raw.sourceType as 'corpus' | 'brain') || 'corpus',
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveChunks(chunks: VectorChunk[]): Promise<void> {
  if (chunks.length === 0) return
  invalidateCache(chunks[0].mindId)

  if (useMemoryFallback) {
    chunks.forEach(c => memoryStore.set(c.id, c))
    return
  }
  try {
    const d = await db()
    const tx = d.transaction(STORE, 'readwrite')
    await Promise.all(chunks.map(c => tx.store.put(toStorable(c))))
    await tx.done
  } catch {
    useMemoryFallback = true
    chunks.forEach(c => memoryStore.set(c.id, c))
  }
}

export async function getChunksForMind(mindId: string): Promise<VectorChunk[]> {
  // Cache hit — skip IndexedDB entirely
  if (_cacheKey === mindId && _cache.length > 0) return _cache

  let chunks: VectorChunk[]

  if (useMemoryFallback) {
    chunks = Array.from(memoryStore.values()).filter(c => c.mindId === mindId)
  } else {
    try {
      const d = await db()
      const raw = await d.getAllFromIndex(STORE, 'mindId', mindId) as Record<string, unknown>[]
      chunks = raw.map(fromStorable)
    } catch {
      useMemoryFallback = true
      chunks = Array.from(memoryStore.values()).filter(c => c.mindId === mindId)
    }
  }

  // Populate cache
  _cacheKey = mindId
  _cache = chunks
  return chunks
}

export async function deleteChunksForMind(mindId: string): Promise<void> {
  invalidateCache(mindId)

  if (useMemoryFallback) {
    for (const [key, val] of memoryStore) {
      if (val.mindId === mindId) memoryStore.delete(key)
    }
    return
  }
  try {
    const d = await db()
    const chunks = await d.getAllFromIndex(STORE, 'mindId', mindId) as { id: string }[]
    const tx = d.transaction(STORE, 'readwrite')
    await Promise.all(chunks.map(c => tx.store.delete(c.id)))
    await tx.done
  } catch {
    useMemoryFallback = true
    for (const [key, val] of memoryStore) {
      if (val.mindId === mindId) memoryStore.delete(key)
    }
  }
}

export async function hasChunks(mindId: string): Promise<boolean> {
  if (_cacheKey === mindId && _cache.length > 0) return true
  if (useMemoryFallback) return Array.from(memoryStore.values()).some(c => c.mindId === mindId)
  try {
    const d = await db()
    const count = await d.countFromIndex(STORE, 'mindId', mindId)
    return count > 0
  } catch {
    useMemoryFallback = true
    return Array.from(memoryStore.values()).some(c => c.mindId === mindId)
  }
}

// ── Cosine similarity (Float32Array native) ───────────────────────────────────
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0
  const len = a.length
  for (let i = 0; i < len; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
}

// ── Tagged TopK: filter by labels first, then score ───────────────────────────
export function topK(
  queryVec: Float32Array,
  chunks: VectorChunk[],
  k = RAG.TOP_K,
  labelFilters?: { topicLabel?: string; registerLabel?: string; sourceType?: string }
): VectorChunk[] {
  // Apply label filters to narrow candidate set before scoring
  let candidates = chunks
  if (labelFilters) {
    const filtered = chunks.filter(c =>
      (!labelFilters.topicLabel   || c.topicLabel   === labelFilters.topicLabel) &&
      (!labelFilters.registerLabel || c.registerLabel === labelFilters.registerLabel) &&
      (!labelFilters.sourceType   || c.sourceType   === labelFilters.sourceType)
    )
    // Only use filtered set if it has enough candidates, else fall back to full set
    if (filtered.length >= k) candidates = filtered
  }

  return candidates
    .map(c => ({ chunk: c, score: cosineSimilarity(queryVec, c.vector) }))
    .filter(x => x.score > RAG.MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(x => x.chunk)
}

export function isUsingMemoryFallback(): boolean {
  return useMemoryFallback
}

// ── Supabase pgvector integration ─────────────────────────────────────────────
// Used for public minds when NEXT_PUBLIC_SUPABASE_URL is configured.
// Falls back to IndexedDB for user-built minds or when Supabase is unavailable.

let _supabase: import('@supabase/supabase-js').SupabaseClient | null = null
let _supabaseLoaded = false

async function getSupabase() {
  if (_supabaseLoaded) return _supabase
  _supabaseLoaded = true
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    const { createClient } = await import('@supabase/supabase-js')
    _supabase = createClient(url, key)
  } catch {
    _supabase = null
  }
  return _supabase
}

export async function saveChunksToSupabase(chunks: VectorChunk[]): Promise<boolean> {
  const sb = await getSupabase()
  if (!sb || chunks.length === 0) return false
  try {
    const rows = chunks.map(c => ({
      id: c.id,
      mind_id: c.mindId,
      text: c.text,
      embedding: Array.from(c.vector),
      topic_label: c.topicLabel || 'general',
      register_label: c.registerLabel || 'balanced',
      source_type: c.sourceType || 'corpus',
    }))
    // Upsert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await sb.from('mind_chunks').upsert(rows.slice(i, i + 100))
      if (error) { console.warn('Supabase upsert error:', error); return false }
    }
    invalidateCache(chunks[0].mindId)
    return true
  } catch (e) {
    console.warn('saveChunksToSupabase failed:', e)
    return false
  }
}

export async function hasChunksInSupabase(mindId: string): Promise<boolean> {
  const sb = await getSupabase()
  if (!sb) return false
  try {
    const { count, error } = await sb
      .from('mind_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('mind_id', mindId)
    if (error) return false
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

export async function querySupabase(
  mindId: string,
  embedding: Float32Array,
  k = RAG.TOP_K,
  topicLabel?: string
): Promise<VectorChunk[]> {
  const sb = await getSupabase()
  if (!sb) return []
  try {
    const { data, error } = await sb.rpc('match_chunks', {
      p_mind_id: mindId,
      p_embedding: Array.from(embedding),
      p_match_count: k,
      p_min_score: RAG.MIN_SCORE,
      p_topic_label: topicLabel || null,
    })
    if (error || !data) return []
    return (data as Array<{id: string; text: string; topic_label: string; register_label: string; source_type: string; similarity: number}>).map(row => ({
      id: row.id,
      mindId,
      text: row.text,
      vector: new Float32Array(0), // not returned from Supabase — not needed post-query
      topicLabel: row.topic_label,
      registerLabel: row.register_label,
      sourceType: row.source_type as 'corpus' | 'brain',
    }))
  } catch (e) {
    console.warn('querySupabase failed:', e)
    return []
  }
}

export async function isSupabaseAvailable(): Promise<boolean> {
  const sb = await getSupabase()
  return sb !== null
}
