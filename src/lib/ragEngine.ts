/**
 * ragEngine.ts
 *
 * Three-tier reply system:
 *
 * Tier 1 — API mode (apiKey set):
 *   RAG retrieval → Claude generation grounded in retrieved chunks
 *
 * Tier 2 — Offline smart mode (no API key, indexed mind):
 *   RAG retrieval → best matching brain reply or corpus sentence,
 *   wrapped in voice-appropriate framing
 *
 * Tier 3 — Offline fallback (no index):
 *   Original replyEngine (keyword + fuzzy + synonym expansion)
 */
import { embedQuery, type EmbedOptions } from './embedder'
import { getChunksForMind, topK, hasChunks } from './vectorStore'
import { localReply, type ReplyResult } from './replyEngine'
import type { Mind, Message } from '../types'

// -- Voice-wrapping prefixes for offline mode ---------------------------------
const OFFLINE_PREFIXES = [
  '',
  'On this: ',
  'What comes to mind: ',
  'Here is what I know of it. ',
  'Let me be direct. ',
  'This is how I would put it. ',
]

function wrapOfflineReply(text: string): string {
  const prefix = OFFLINE_PREFIXES[Math.floor(Math.random() * OFFLINE_PREFIXES.length)]
  return prefix + text
}

// -- Deduplication: filter chunks with >60% word overlap with already-selected --
function deduplicateChunks<T extends { text: string }>(chunks: T[]): T[] {
  const selected: T[] = []
  for (const chunk of chunks) {
    const words = new Set(chunk.text.toLowerCase().split(/\s+/))
    const isDuplicate = selected.some(s => {
      const sWords = new Set(s.text.toLowerCase().split(/\s+/))
      const intersection = [...words].filter(w => sWords.has(w)).length
      return intersection / words.size > 0.6
    })
    if (!isDuplicate) selected.push(chunk)
  }
  return selected
}

// -- Tier 1: API generation with RAG context ----------------------------------
async function tier1Generation(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey: string,
  embedOpts: EmbedOptions
): Promise<ReplyResult> {
  // Retrieve relevant chunks
  const queryVec = await embedQuery(userMessage, embedOpts)
  const chunks = await getChunksForMind(mind.id)
  const relevant = deduplicateChunks(topK(queryVec, chunks, 5))

  const context = relevant.map(c => c.text).join('\n\n')

  // Build a rich system prompt grounded in retrieved material
  const systemPrompt = [
    mind.system || `You are ${mind.name}. Speak in their voice.`,
    '',
    context
      ? `The following passages are from ${mind.name}'s documented words and writings. Ground your response in this material. Quote or closely paraphrase where relevant. Do not invent anecdotes that contradict this material:\n\n---\n${context}\n---`
      : '',
    '',
    'Respond in 2–5 sentences in their distinctive voice. End with [Source: <work>] when drawing from specific material.',
    'If you cannot answer from the available material, say so honestly in character.',
  ].filter(Boolean).join('\n')

  // Fix: bump history to last 40 messages for longer conversation context
  const recentHistory = history.slice(-40)
  const messages = [
    ...recentHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  // Bug #4 fix: proxy via server-side API route — API key never exposed to browser
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  const sourceMatch = text.match(/\[Source:\s*([^\]]+)\]/)
  const source = sourceMatch ? sourceMatch[1].trim() : mind.name
  const reply = text.replace(/\[Source:[^\]]+\]/g, '').trim()

  return { reply, source, engine: 'llm' }
}

// -- Tier 2: Offline RAG — retrieval + best reply selection -------------------
async function tier2Offline(
  mind: Mind,
  userMessage: string,
  history: Message[],
  embedOpts: EmbedOptions
): Promise<ReplyResult> {
  const queryVec = await embedQuery(userMessage, embedOpts)
  const chunks = await getChunksForMind(mind.id)
  const relevant = deduplicateChunks(topK(queryVec, chunks, 3))

  if (relevant.length === 0) {
    // No relevant chunks — fall through to Tier 3
    return localReply(mind, userMessage, history)
  }

  // Check if top chunk is a brain entry (id contains '-brain-')
  const topChunk = relevant[0]
  if (topChunk.id.includes('-brain-')) {
    const brainPart = topChunk.id.split('-brain-')[1]
    const parts = brainPart ? brainPart.split('-') : []
    const topicIdx = parts[0] ? parseInt(parts[0]) : 0
    const replyIdx = parts[1] ? parseInt(parts[1]) : 0
    const brainEntries = mind.brain || []
    const entry = brainEntries[topicIdx]
    if (entry?.replies?.[replyIdx]) {
      return {
        reply: wrapOfflineReply(entry.replies[replyIdx].t),
        source: entry.replies[replyIdx].s || mind.name,
        engine: 'offline-brain',
      }
    }
  }

  // Use top corpus chunk, wrapped in voice framing
  const bestText = topChunk.text.trim()
  return {
    reply: wrapOfflineReply(bestText),
    source: mind.name,
    engine: 'offline-rag',
  }
}

// -- Public entry point -------------------------------------------------------
export async function ragReply(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey: string | null,
  embedOpts: EmbedOptions
): Promise<ReplyResult> {
  const indexed = await hasChunks(mind.id)

  if (apiKey && indexed) {
    try {
      return await tier1Generation(mind, userMessage, history, apiKey, embedOpts)
    } catch (err) {
      console.warn('Tier 1 failed, falling back to Tier 2:', err)
    }
  }

  if (indexed) {
    try {
      return await tier2Offline(mind, userMessage, history, embedOpts)
    } catch (err) {
      console.warn('Tier 2 failed, falling back to Tier 3:', err)
    }
  }

  // Tier 3 fallback
  return localReply(mind, userMessage, history)
}
