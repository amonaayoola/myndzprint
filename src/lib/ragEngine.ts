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

// ── Voice-wrapping prefixes for offline mode ─────────────────────────────────
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

// ── Tier 1: API generation with RAG context ──────────────────────────────────
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
  const relevant = topK(queryVec, chunks, 5)

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

  // Bug #8 fix: truncate history to last 20 messages before sending to Claude
  const recentHistory = history.slice(-20)
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

// ── Tier 2: Offline RAG — retrieval + best reply selection ───────────────────
async function tier2Offline(
  mind: Mind,
  userMessage: string,
  history: Message[],
  embedOpts: EmbedOptions
): Promise<ReplyResult> {
  const queryVec = await embedQuery(userMessage, embedOpts)
  const chunks = await getChunksForMind(mind.id)
  const relevant = topK(queryVec, chunks, 3)

  if (relevant.length === 0) {
    // No relevant chunks — fall through to Tier 3
    return localReply(mind, userMessage, history)
  }

  // Check if top chunk is a brain entry (id contains '-brain-')
  const topChunk = relevant[0]
  if (topChunk.id.includes('-brain-')) {
    const brainPart = topChunk.id.split('-brain-')[1]
    const parts = brainPart ? brainPart.split('-') : []
    const eIdx = parseInt(parts[0])
    const rIdx = parseInt(parts[1])
    if (!isNaN(eIdx) && !isNaN(rIdx)) {
      const entry = mind.brain?.[eIdx]
      const reply = entry?.replies?.[rIdx]
      if (reply) {
        return { reply: reply.t, source: reply.s, engine: 'local' }
      }
    }
  }

  // Top chunk is a corpus passage — use it directly, wrapped in voice
  const best = relevant
    .map(c => c.text)
    .join(' ')
    .slice(0, 400)

  return {
    reply: wrapOfflineReply(best),
    source: mind.name,
    engine: 'local',
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export type ReplyTier = 'api-rag' | 'offline-rag' | 'offline-fallback'

export interface RagReplyResult extends ReplyResult {
  tier: ReplyTier
}

export async function ragReply(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey?: string
): Promise<RagReplyResult> {
  // hasChunks can fail in private browsing where IndexedDB is blocked
  let hasIndex = false
  try { hasIndex = await hasChunks(mind.id) } catch { /* IDB unavailable */ }

  // Bug #3 fix: NEXT_PUBLIC_ removed — embedder now proxies through /api/embeddings server-side
  const embedOpts: EmbedOptions = {}

  // Tier 1: API + RAG
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const result = await tier1Generation(mind, userMessage, history, apiKey, embedOpts)
      return { ...result, tier: 'api-rag' }
    } catch (err) {
      console.warn('Tier 1 failed, falling back:', err)
    }
  }

  // Tier 2: Offline RAG (needs an indexed mind)
  if (hasIndex) {
    try {
      const result = await tier2Offline(mind, userMessage, history, embedOpts)
      return { ...result, tier: 'offline-rag' }
    } catch (err) {
      console.warn('Tier 2 failed, falling back:', err)
    }
  }

  // Tier 3: Original keyword engine — always works
  const result = localReply(mind, userMessage, history)
  return { ...result, tier: 'offline-fallback' }
}
