/**
 * vectorStore.ts
 * Persists embedding vectors in IndexedDB so they survive page reloads.
 * Each chunk = { id, mindId, text, vector: Float32Array }
 */
import { openDB, type IDBPDatabase } from 'idb'

export interface VectorChunk {
  id: string
  mindId: string
  text: string
  vector: number[]
}

const DB_NAME = 'myndzprint-vectors'
const STORE = 'chunks'
const VERSION = 1

let _db: IDBPDatabase | null = null

async function db(): Promise<IDBPDatabase> {
  if (_db) return _db
  try {
    _db = await openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('mindId', 'mindId')
        }
      },
    })
  } catch (err) {
    throw new Error(`IndexedDB unavailable (private browsing?): ${err}`)
  }
  return _db
}

export async function saveChunks(chunks: VectorChunk[]): Promise<void> {
  const d = await db()
  const tx = d.transaction(STORE, 'readwrite')
  await Promise.all(chunks.map(c => tx.store.put(c)))
  await tx.done
}

export async function getChunksForMind(mindId: string): Promise<VectorChunk[]> {
  const d = await db()
  return d.getAllFromIndex(STORE, 'mindId', mindId)
}

export async function deleteChunksForMind(mindId: string): Promise<void> {
  const d = await db()
  const chunks = await getChunksForMind(mindId)
  const tx = d.transaction(STORE, 'readwrite')
  await Promise.all(chunks.map(c => tx.store.delete(c.id)))
  await tx.done
}

export async function hasChunks(mindId: string): Promise<boolean> {
  const d = await db()
  const count = await d.countFromIndex(STORE, 'mindId', mindId)
  return count > 0
}

// ── Cosine similarity ────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
}

export function topK(
  queryVec: number[],
  chunks: VectorChunk[],
  k = 4
): VectorChunk[] {
  return chunks
    .map(c => ({ chunk: c, score: cosineSimilarity(queryVec, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter(x => x.score > 0.2)
    .map(x => x.chunk)
}
