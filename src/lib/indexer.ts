/**
 * indexer.ts
 * Orchestrates: chunk corpus → embed → save to IndexedDB
 * Called when a mind is built or its corpus is updated.
 */
import { chunkCorpus, chunkBrain } from './chunker'
import { embedTexts, type EmbedOptions } from './embedder'
import { saveChunks, deleteChunksForMind, type VectorChunk } from './vectorStore'
import type { Mind } from '../types'

export interface IndexProgress {
  stage: 'chunking' | 'embedding' | 'saving' | 'done'
  progress: number   // 0–1
  chunkCount: number
}

type ProgressCallback = (p: IndexProgress) => void

/** Embed a batch of texts with a timeout. Rejects if it takes longer than `ms`. */
function embedWithTimeout(
  batch: string[],
  embedOpts: EmbedOptions,
  ms: number
): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Embed batch timed out after ${ms}ms`)), ms)
    embedTexts(batch, embedOpts)
      .then(vecs => { clearTimeout(timer); resolve(vecs) })
      .catch(err => { clearTimeout(timer); reject(err) })
  })
}

export async function indexMind(
  mind: Mind,
  embedOpts: EmbedOptions = {},
  onProgress?: ProgressCallback
): Promise<number> {
  onProgress?.({ stage: 'chunking', progress: 0, chunkCount: 0 })

  // 1. Chunk the corpus
  const corpusChunks = chunkCorpus(mind.corpus || '')
  const brainChunks = chunkBrain(mind)

  const allTexts = [
    ...corpusChunks.map(c => c.text),
    ...brainChunks.map(c => c.text),
  ]

  if (allTexts.length === 0) return 0

  onProgress?.({ stage: 'embedding', progress: 0.1, chunkCount: allTexts.length })

  // 2. Embed in batches — reduced from 32 to 16 for reliability
  const BATCH = 16
  const BATCH_TIMEOUT_MS = 30_000
  const allVectors: number[][] = []

  for (let i = 0; i < allTexts.length; i += BATCH) {
    const batch = allTexts.slice(i, i + BATCH)

    let vecs: number[][] | null = null

    // First attempt: full batch
    try {
      vecs = await embedWithTimeout(batch, embedOpts, BATCH_TIMEOUT_MS)
    } catch (err) {
      console.warn(`Embed batch [${i}..${i + batch.length - 1}] failed (attempt 1), retrying with smaller batch:`, err)

      // Retry with smaller batch size of 8
      const SMALL_BATCH = 8
      const smallBatchVecs: number[][] = []
      let retryOk = true

      for (let j = 0; j < batch.length; j += SMALL_BATCH) {
        const smallBatch = batch.slice(j, j + SMALL_BATCH)
        try {
          const sv = await embedWithTimeout(smallBatch, embedOpts, BATCH_TIMEOUT_MS)
          smallBatchVecs.push(...sv)
        } catch (retryErr) {
          console.warn(`Small batch [${i + j}..${i + j + smallBatch.length - 1}] also failed, skipping:`, retryErr)
          // Fill with zero vectors so indices stay aligned
          for (let k = 0; k < smallBatch.length; k++) {
            smallBatchVecs.push([])
          }
          retryOk = false
        }
      }

      vecs = smallBatchVecs
      if (!retryOk) {
        console.warn(`Some chunks in batch [${i}..${i + batch.length - 1}] were skipped due to embed errors.`)
      }
    }

    allVectors.push(...vecs)

    // Always call onProgress after each batch so the UI stays responsive
    onProgress?.({
      stage: 'embedding',
      progress: 0.1 + 0.7 * ((i + batch.length) / allTexts.length),
      chunkCount: allTexts.length,
    })
  }

  onProgress?.({ stage: 'saving', progress: 0.8, chunkCount: allTexts.length })

  // 3. Clear old chunks for this mind
  await deleteChunksForMind(mind.id)

  // 4. Build VectorChunk objects (skip any that have empty/zero vectors)
  const chunks: VectorChunk[] = []

  corpusChunks.forEach((c, i) => {
    const vec = allVectors[i]
    if (!vec || vec.length === 0) return  // skip failed embeddings
    chunks.push({
      id: `${mind.id}-corpus-${i}`,
      mindId: mind.id,
      text: c.text,
      vector: vec,
    })
  })

  brainChunks.forEach((c, i) => {
    const vecIdx = corpusChunks.length + i
    const vec = allVectors[vecIdx]
    if (!vec || vec.length === 0) return  // skip failed embeddings
    chunks.push({
      id: `${mind.id}-brain-${c.entryIdx}-${c.replyIdx}`,
      mindId: mind.id,
      text: c.text,
      vector: vec,
    })
  })

  // 5. Save to IndexedDB
  await saveChunks(chunks)

  onProgress?.({ stage: 'done', progress: 1, chunkCount: chunks.length })
  return chunks.length
}

/**
 * Re-index a mind unconditionally — use when corpus is updated.
 */
export async function reIndexMind(
  mind: Mind,
  embedOpts: EmbedOptions = {},
  onProgress?: ProgressCallback
): Promise<number> {
  await deleteChunksForMind(mind.id)
  return indexMind(mind, embedOpts, onProgress)
}

/**
 * Index all public minds that haven't been indexed yet.
 * Called once on app startup in the background.
 */
export async function indexPublicMindsIfNeeded(
  minds: Mind[],
  embedOpts: EmbedOptions = {}
): Promise<void> {
  const { hasChunks } = await import('./vectorStore')
  for (const mind of minds) {
    if (!mind.corpus) continue
    const already = await hasChunks(mind.id)
    if (!already) {
      await indexMind(mind, embedOpts).catch(err =>
        console.warn(`Failed to index ${mind.id}:`, err)
      )
    }
  }
}

export type IndexStatus = 'indexed' | 'not-indexed' | 'no-corpus'

export async function getIndexStatus(mind: Mind): Promise<IndexStatus> {
  if (!mind.corpus && !mind.brain?.length) return 'no-corpus'
  const { hasChunks } = await import('./vectorStore')
  const indexed = await hasChunks(mind.id)
  return indexed ? 'indexed' : 'not-indexed'
}
