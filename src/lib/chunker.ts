/**
 * chunker.ts
 * Splits a corpus into overlapping chunks suitable for embedding.
 * Uses sentence boundaries where possible for clean context windows.
 */

export interface TextChunk {
  text: string
  index: number
}

const TARGET_CHUNK_TOKENS = 350   // ~350 words per chunk
const OVERLAP_TOKENS = 60         // ~60 word overlap between chunks

function roughTokenCount(text: string): number {
  return text.split(/\s+/).length
}

/**
 * Split text into sentences, respecting paragraph breaks.
 */
function splitSentences(text: string): string[] {
  return text
    .replace(/\n{2,}/g, '\n\n')   // normalise paragraph breaks
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\n\n)/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Chunk a corpus into overlapping windows of roughly TARGET_CHUNK_TOKENS words.
 * Each chunk is a coherent passage — never cuts mid-sentence.
 */
export function chunkCorpus(corpus: string): TextChunk[] {
  if (!corpus || corpus.trim().length === 0) return []

  const sentences = splitSentences(corpus)
  const chunks: TextChunk[] = []
  let buffer: string[] = []
  let bufferTokens = 0
  let chunkIndex = 0

  for (const sentence of sentences) {
    const sentTokens = roughTokenCount(sentence)

    // If adding this sentence exceeds target, flush the buffer
    if (bufferTokens + sentTokens > TARGET_CHUNK_TOKENS && buffer.length > 0) {
      chunks.push({ text: buffer.join(' '), index: chunkIndex++ })

      // Keep last N tokens as overlap context for the next chunk
      const overlapBuffer: string[] = []
      let overlapCount = 0
      for (let i = buffer.length - 1; i >= 0; i--) {
        const t = roughTokenCount(buffer[i])
        if (overlapCount + t > OVERLAP_TOKENS) break
        overlapBuffer.unshift(buffer[i])
        overlapCount += t
      }
      buffer = overlapBuffer
      bufferTokens = overlapCount
    }

    buffer.push(sentence)
    bufferTokens += sentTokens
  }

  // Flush remainder
  if (buffer.length > 0) {
    chunks.push({ text: buffer.join(' '), index: chunkIndex })
  }

  // Filter chunks that are too short to be useful
  return chunks.filter(c => roughTokenCount(c.text) >= 15)
}

/**
 * Also extract brain entry text for embedding alongside the corpus.
 * This way brain replies participate in semantic search too.
 */
export interface BrainChunk {
  text: string
  replyText: string
  source: string
  entryIdx: number
  replyIdx: number
}

import type { Mind } from '../types'

export function chunkBrain(mind: Mind): BrainChunk[] {
  const result: BrainChunk[] = []
  if (!mind.brain) return result

  mind.brain.forEach((entry, eIdx) => {
    if (entry.keys[0] === '__redirect__') return
    // Combine keys into a search text for this entry
    const keyText = entry.keys.join('. ')
    entry.replies.forEach((reply, rIdx) => {
      result.push({
        text: keyText + '. ' + reply.t.slice(0, 200),
        replyText: reply.t,
        source: reply.s,
        entryIdx: eIdx,
        replyIdx: rIdx,
      })
    })
  })

  return result
}
