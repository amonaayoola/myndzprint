/**
 * chunker.ts
 * Splits a corpus into overlapping chunks suitable for embedding.
 * Each chunk is labeled with topic, register, and source type
 * for TagRAG-style filtered retrieval.
 */

export interface TextChunk {
  text: string
  index: number
  topicLabel: string
  registerLabel: string
  sourceType: 'corpus'
}

import { RAG } from './config'
const TARGET_CHUNK_TOKENS = RAG.CHUNK_TOKENS
const OVERLAP_TOKENS = RAG.OVERLAP_TOKENS

function roughTokenCount(text: string): number {
  return text.split(/\s+/).length
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n{2,}/g, '\n\n')
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\n\n)/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

// ── Label detection ───────────────────────────────────────────────────────────

const TOPIC_SIGNALS: Record<string, string[]> = {
  philosophy:    ['truth', 'virtue', 'reason', 'principle', 'ethics', 'justice', 'soul', 'universe', 'nature', 'moral', 'philosophy', 'wisdom', 'good', 'evil', 'knowledge'],
  suffering:     ['pain', 'suffer', 'hardship', 'loss', 'grief', 'endure', 'struggle', 'adversity', 'trial', 'overcome', 'fear', 'death', 'obstacle', 'burden', 'wound'],
  purpose:       ['purpose', 'meaning', 'mission', 'duty', 'call', 'goal', 'life', 'direction', 'serve', 'destiny', 'why', 'reason for', 'contribution'],
  wisdom:        ['learn', 'lesson', 'remember', 'experience', 'practice', 'discipline', 'habit', 'observe', 'understand', 'insight', 'know', 'realize'],
  relationships: ['people', 'friend', 'love', 'family', 'community', 'trust', 'bond', 'human', 'together', 'kindness', 'compassion', 'other', 'neighbor', 'enemy'],
  work:          ['work', 'craft', 'create', 'build', 'effort', 'practice', 'skill', 'mastery', 'focus', 'discipline', 'diligence', 'persist', 'labor', 'toil'],
  death:         ['death', 'die', 'mortality', 'legacy', 'end', 'dying', 'finite', 'eternal', 'memory', 'gone', 'mourn', 'grave', 'perish'],
  happiness:     ['happy', 'joy', 'peace', 'content', 'freedom', 'enough', 'gratitude', 'flourish', 'good life', 'well', 'pleasure', 'delight', 'bliss'],
  power:         ['power', 'authority', 'leader', 'govern', 'ruler', 'command', 'emperor', 'king', 'responsibility', 'decision', 'control'],
  time:          ['time', 'moment', 'present', 'past', 'future', 'now', 'hour', 'day', 'year', 'age', 'century', 'transient', 'fleeting', 'eternal'],
}

function detectTopicLabel(text: string): string {
  const lower = text.toLowerCase()
  let best = 'general'
  let bestScore = 0
  for (const [topic, signals] of Object.entries(TOPIC_SIGNALS)) {
    const score = signals.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = topic }
  }
  return best
}

function detectRegisterLabel(text: string): 'abstract' | 'concrete' | 'emotional' | 'balanced' {
  const lower = text.toLowerCase()
  const abstract  = (lower.match(/\b(truth|virtue|justice|reason|principle|essence|consciousness|universal|absolute|infinite|soul|spirit|morality|duty|honor|wisdom|knowledge|belief)\b/g) || []).length
  const concrete  = (lower.match(/\b(work|build|make|act|step|hand|foot|road|fire|water|stone|body|money|child|family|book|letter|day|night|year|city|hand)\b/g) || []).length
  const emotional = (lower.match(/\b(feel|love|fear|hope|grief|anger|joy|pain|suffer|hurt|cry|laugh|miss|desire|shame|proud|brave|afraid|alone|lost|broken)\b/g) || []).length
  const max = Math.max(abstract, concrete, emotional)
  if (max === 0) return 'balanced'
  if (abstract === max) return 'abstract'
  if (emotional === max) return 'emotional'
  if (concrete === max) return 'concrete'
  return 'balanced'
}

// ── Main chunker ──────────────────────────────────────────────────────────────

export function chunkCorpus(corpus: string): TextChunk[] {
  if (!corpus || corpus.trim().length === 0) return []

  const sentences = splitSentences(corpus)
  const chunks: TextChunk[] = []
  let buffer: string[] = []
  let bufferTokens = 0
  let chunkIndex = 0

  for (const sentence of sentences) {
    const sentTokens = roughTokenCount(sentence)

    if (bufferTokens + sentTokens > TARGET_CHUNK_TOKENS && buffer.length > 0) {
      const text = buffer.join(' ')
      chunks.push({
        text,
        index: chunkIndex++,
        topicLabel: detectTopicLabel(text),
        registerLabel: detectRegisterLabel(text),
        sourceType: 'corpus',
      })

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

  if (buffer.length > 0) {
    const text = buffer.join(' ')
    chunks.push({
      text,
      index: chunkIndex,
      topicLabel: detectTopicLabel(text),
      registerLabel: detectRegisterLabel(text),
      sourceType: 'corpus',
    })
  }

  return chunks.filter(c => roughTokenCount(c.text) >= 15)
}

// ── Brain chunker ─────────────────────────────────────────────────────────────

export interface BrainChunk {
  text: string
  replyText: string
  source: string
  entryIdx: number
  replyIdx: number
  topicLabel: string
  registerLabel: string
  sourceType: 'brain'
}

import type { Mind } from '../types'

export function chunkBrain(mind: Mind): BrainChunk[] {
  const result: BrainChunk[] = []
  if (!mind.brain) return result

  mind.brain.forEach((entry, eIdx) => {
    if (entry.keys[0] === '__redirect__') return
    const keyText = entry.keys.join('. ')
    const topicLabel = entry.topic || detectTopicLabel(keyText)
    entry.replies.forEach((reply, rIdx) => {
      const combined = keyText + '. ' + reply.t.slice(0, 200)
      result.push({
        text: combined,
        replyText: reply.t,
        source: reply.s,
        entryIdx: eIdx,
        replyIdx: rIdx,
        topicLabel,
        registerLabel: detectRegisterLabel(reply.t),
        sourceType: 'brain',
      })
    })
  })

  return result
}
