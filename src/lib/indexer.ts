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

  // 2. Embed in batches of 32 to avoid memory spikes
  const BATCH = 32
  const allVectors: number[][] = []
  for (let i = 0; i < allTexts.length; i += BATCH) {
    const batch = allTexts.slice(i, i + BATCH)
    const vecs = await embedTexts(batch, embedOpts)
    allVectors.push(...vecs)
    onProgress?.({
      stage: 'embedding',
      progress: 0.1 + 0.7 * ((i + batch.length) / allTexts.length),
      chunkCount: allTexts.length,
    })
  }

  onProgress?.({ stage: 'saving', progress: 0.8, chunkCount: allTexts.length })

  // 3. Clear old chunks for this mind
  await deleteChunksForMind(mind.id)

  // 4. Build VectorChunk objects
  const chunks: VectorChunk[] = []

  corpusChunks.forEach((c, i) => {
    chunks.push({
      id: `${mind.id}-corpus-${i}`,
      mindId: mind.id,
      text: c.text,
      vector: allVectors[i],
    })
  })

  brainChunks.forEach((c, i) => {
    const vecIdx = corpusChunks.length + i
    chunks.push({
      id: `${mind.id}-brain-${c.entryIdx}-${c.replyIdx}`,
      mindId: mind.id,
      text: c.text,
      vector: allVectors[vecIdx],
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
