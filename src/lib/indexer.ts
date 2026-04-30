/**
 * indexer.ts
 * Orchestrates: chunk corpus → label → embed → save to IndexedDB
 * Called when a mind is built or its corpus is updated.
 * Chunks carry topic/register/source labels for TagRAG-style retrieval.
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

  const corpusChunks = chunkCorpus(mind.corpus || '')
  const brainChunks  = chunkBrain(mind)

  const allTexts = [
    ...corpusChunks.map(c => c.text),
    ...brainChunks.map(c => c.text),
  ]

  if (allTexts.length === 0) return 0

  onProgress?.({ stage: 'embedding', progress: 0.1, chunkCount: allTexts.length })

  // Embed in batches — smaller batch = less memory pressure, more stable
  const BATCH = 16
  const TIMEOUT_MS = 30_000
  const allVectors: Float32Array[] = []

  for (let i = 0; i < allTexts.length; i += BATCH) {
    const batch = allTexts.slice(i, i + BATCH)

    let vecs: Float32Array[]
    try {
      vecs = await Promise.race([
        embedTexts(batch, embedOpts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('embed timeout')), TIMEOUT_MS)
        ),
      ])
    } catch {
      // Retry at half batch size before giving up on this batch
      try {
        const half = Math.ceil(batch.length / 2)
        const v1 = await embedTexts(batch.slice(0, half), embedOpts)
        const v2 = await embedTexts(batch.slice(half), embedOpts)
        vecs = [...v1, ...v2]
      } catch {
        // Skip batch entirely with zero vectors so indexing always completes
        console.warn(`Skipping batch at offset ${i} after retry failure`)
        vecs = batch.map(() => new Float32Array(384))
      }
    }

    allVectors.push(...vecs)
    onProgress?.({
      stage: 'embedding',
      progress: 0.1 + 0.7 * ((i + batch.length) / allTexts.length),
      chunkCount: allTexts.length,
    })
  }

  onProgress?.({ stage: 'saving', progress: 0.8, chunkCount: allTexts.length })

  await deleteChunksForMind(mind.id)

  const chunks: VectorChunk[] = []

  corpusChunks.forEach((c, i) => {
    if (!allVectors[i]) return
    chunks.push({
      id: `${mind.id}-corpus-${i}`,
      mindId: mind.id,
      text: c.text,
      vector: allVectors[i],
      topicLabel: c.topicLabel,
      registerLabel: c.registerLabel,
      sourceType: 'corpus',
    })
  })

  brainChunks.forEach((c, i) => {
    const vecIdx = corpusChunks.length + i
    if (!allVectors[vecIdx]) return
    chunks.push({
      id: `${mind.id}-brain-${c.entryIdx}-${c.replyIdx}`,
      mindId: mind.id,
      text: c.text,
      vector: allVectors[vecIdx],
      topicLabel: c.topicLabel,
      registerLabel: c.registerLabel,
      sourceType: 'brain',
    })
  })

  await saveChunks(chunks)

  onProgress?.({ stage: 'done', progress: 1, chunkCount: chunks.length })
  return chunks.length
}

export async function reIndexMind(
  mind: Mind,
  embedOpts: EmbedOptions = {},
  onProgress?: ProgressCallback
): Promise<number> {
  await deleteChunksForMind(mind.id)
  return indexMind(mind, embedOpts, onProgress)
}

export async function indexPublicMindsIfNeeded(
  minds: Mind[],
  embedOpts: EmbedOptions = {}
): Promise<void> {
  const { hasChunks } = await import('./vectorStore')

  // Corpus is stripped from localStorage to save space, then restored from
  // the CORPUS map on rehydration. Re-attach it here to guarantee indexMind
  // always has text to chunk, even if the mind object came from a stale store.
  const { CORPUS } = await import('../data/corpus')

  for (const mind of minds) {
    const corpus = mind.corpus || CORPUS[mind.id] || ''
    if (!corpus && !mind.brain?.length) continue
    const already = await hasChunks(mind.id)
    if (!already) {
      const mindWithCorpus = corpus !== mind.corpus ? { ...mind, corpus } : mind
      await indexMind(mindWithCorpus, embedOpts).catch(err =>
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
