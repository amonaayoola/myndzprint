/**
 * ragEngine.ts
 *
 * Three-tier reply system with TagRAG-style labeled retrieval:
 *
 * Tier 1 — API mode (apiKey set):
 *   Intent detection → label filter → topK cosine → LLM generation
 *
 * Tier 2 — Offline smart mode (no API key, indexed mind):
 *   Intent detection → label filter → topK cosine → best brain reply or corpus sentence
 *
 * Tier 3 — Offline fallback (no index):
 *   Original replyEngine (keyword + fuzzy + synonym expansion)
 *
 * TagRAG benefit: narrows candidate set by topic/register before cosine scoring,
 * so retrieval is faster and more precise. Falls back to full scan if filter
 * yields too few candidates.
 */
import { embedQuery, type EmbedOptions } from './embedder'
import { getChunksForMind, topK, hasChunks, querySupabase, hasChunksInSupabase, isSupabaseAvailable } from './vectorStore'
import { localReply, type ReplyResult } from './replyEngine'
import type { Mind, Message } from '../types'

export type ReplyTier = 'api-rag' | 'offline-rag' | 'offline-fallback'
// ── Intent detection: map a user message to topic + register labels ───────────

const INTENT_TOPICS: Record<string, string[]> = {
  philosophy:    ['philosophy', 'truth', 'virtue', 'belief', 'ethics', 'moral', 'principle', 'meaning of life', 'what is', 'nature of', 'universe'],
  suffering:     ['pain', 'suffer', 'hurt', 'grief', 'loss', 'struggle', 'hard time', 'difficult', 'adversity', 'broken', 'overwhelmed', 'depressed', 'anxiety'],
  purpose:       ['purpose', 'meaning', 'why am i', 'what should i do', 'direction', 'calling', 'mission', 'lost', 'goal', 'life goal'],
  wisdom:        ['wisdom', 'advice', 'lesson', 'what have you learned', 'teach', 'guidance', 'insight', 'knowledge'],
  relationships: ['people', 'relationship', 'friend', 'family', 'love', 'trust', 'community', 'connection', 'lonely', 'alone'],
  work:          ['work', 'career', 'craft', 'discipline', 'focus', 'effort', 'skill', 'practice', 'mastery', 'success', 'productivity'],
  death:         ['death', 'die', 'mortality', 'legacy', 'dying', 'life is short', 'what happens when we die', 'end'],
  happiness:     ['happy', 'happiness', 'joy', 'peace', 'content', 'fulfillment', 'good life', 'flourish', 'gratitude'],
  power:         ['power', 'leader', 'authority', 'govern', 'responsibility', 'decision', 'control', 'influence'],
  time:          ['time', 'present', 'moment', 'slow down', 'busy', 'patience', 'now', 'past', 'future'],
}

const INTENT_REGISTERS: Record<string, string[]> = {
  abstract:  ['truth', 'virtue', 'justice', 'reason', 'principle', 'essence', 'consciousness', 'soul', 'spirit', 'universal', 'philosophy'],
  emotional: ['feel', 'hurt', 'love', 'fear', 'grief', 'anger', 'joy', 'pain', 'suffer', 'lonely', 'broken', 'hope', 'shame'],
  concrete:  ['work', 'build', 'do', 'make', 'step', 'action', 'practice', 'habit', 'routine', 'day', 'money', 'job'],
}

function detectIntent(message: string): { topicLabel?: string; registerLabel?: string } {
  const lower = message.toLowerCase()

  let bestTopic = ''
  let bestTopicScore = 0
  for (const [topic, signals] of Object.entries(INTENT_TOPICS)) {
    const score = signals.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0)
    if (score > bestTopicScore) { bestTopicScore = score; bestTopic = topic }
  }

  let bestRegister = ''
  let bestRegisterScore = 0
  for (const [register, signals] of Object.entries(INTENT_REGISTERS)) {
    const score = signals.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0)
    if (score > bestRegisterScore) { bestRegisterScore = score; bestRegister = register }
  }

  return {
    topicLabel:    bestTopicScore >= 1 ? bestTopic : undefined,
    registerLabel: bestRegisterScore >= 2 ? bestRegister : undefined,
  }
}

// ── Deduplication: filter chunks with >60% word overlap ──────────────────────
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

// ── Strip em dashes from generated text ──────────────────────────────────────
function stripEmDash(text: string): string {
  return text.replace(/\s*—\s*/g, '. ').replace(/–/g, '-').replace(/\s{2,}/g, ' ').trim()
}

// ── Tier 1: API generation with labeled RAG context ──────────────────────────
async function tier1Generation(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey: string,
  provider: string,
  model: string,
  embedOpts: EmbedOptions
): Promise<ReplyResult> {
  const queryVec = await embedQuery(userMessage, embedOpts)
  const intent = detectIntent(userMessage)

  // Use Supabase pgvector when available (faster, server-side similarity search)
  // Fall back to local IndexedDB + cosine scoring
  let relevant: Awaited<ReturnType<typeof getChunksForMind>>
  const sbAvailable = await isSupabaseAvailable()
  if (sbAvailable) {
    relevant = deduplicateChunks(await querySupabase(mind.id, queryVec, 5, intent.topicLabel))
  } else {
    const allChunks = await getChunksForMind(mind.id)
    relevant = deduplicateChunks(topK(queryVec, allChunks, 5, intent))
  }

  const context = relevant.map(c => c.text).join('\n\n')

  const systemPrompt = [
    mind.system || `You are ${mind.name}. Speak in their voice.`,
    '',
    context
      ? `The following passages are from ${mind.name}'s documented words and writings. Ground your response in this material. Quote or closely paraphrase where relevant. Do not invent facts that contradict this material:\n\n---\n${context}\n---`
      : '',
    '',
    'Respond in 2-4 sentences in their distinctive voice.',
    'Never use em dashes. Use a period or comma instead.',
    'End with [Source: <work>] when drawing from specific material.',
    'If you cannot answer from the available material, say so honestly in character.',
  ].filter(Boolean).join('\n')

  const recentHistory = history.slice(-40)
  const messages = [
    ...recentHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      provider: provider || 'anthropic',
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(`API error ${res.status}: ${err?.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const text = stripEmDash((data.content?.[0]?.text || '').trim())
  const sourceMatch = text.match(/\[Source:\s*([^\]]+)\]/)
  const source = sourceMatch ? sourceMatch[1].trim() : mind.name
  const reply = text.replace(/\[Source:[^\]]+\]/g, '').trim()

  return { reply, source, engine: 'llm' }
}

// ── Tier 2: Offline RAG — labeled retrieval + best reply selection ─────────────
async function tier2Offline(
  mind: Mind,
  userMessage: string,
  history: Message[],
  embedOpts: EmbedOptions
): Promise<ReplyResult> {
  const queryVec = await embedQuery(userMessage, embedOpts)
  const allChunks = await getChunksForMind(mind.id)

  const intent = detectIntent(userMessage)
  const relevant = deduplicateChunks(topK(queryVec, allChunks, 3, intent))

  if (relevant.length === 0) {
    return localReply(mind, userMessage, history)
  }

  const topChunk = relevant[0]

  // Brain chunk: route directly to the stored reply
  if (topChunk.id.includes('-brain-')) {
    const brainPart = topChunk.id.split('-brain-')[1]
    const parts = brainPart ? brainPart.split('-') : []
    const topicIdx = parts[0] ? parseInt(parts[0]) : 0
    const replyIdx  = parts[1] ? parseInt(parts[1]) : 0
    const entry = (mind.brain || [])[topicIdx]
    if (entry?.replies?.[replyIdx]) {
      return {
        reply: stripEmDash(entry.replies[replyIdx].t),
        source: entry.replies[replyIdx].s || mind.name,
        engine: 'offline-brain',
      }
    }
  }

  return {
    reply: stripEmDash(topChunk.text.trim()),
    source: mind.name,
    engine: 'offline-rag',
  }
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function ragReply(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey: string | null,
  embedOpts: EmbedOptions,
  provider = 'anthropic',
  model = 'claude-haiku-4-5-20251001'
): Promise<ReplyResult> {
  // Check both IndexedDB and Supabase for indexed content
  const [localIndexed, sbAvailable, sbIndexed] = await Promise.all([
    hasChunks(mind.id),
    isSupabaseAvailable(),
    isSupabaseAvailable().then(avail => avail ? hasChunksInSupabase(mind.id) : false),
  ])
  const indexed = localIndexed || sbIndexed

  if (apiKey && indexed) {
    try {
      return await tier1Generation(mind, userMessage, history, apiKey, provider, model, embedOpts)
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

  return localReply(mind, userMessage, history)
}
