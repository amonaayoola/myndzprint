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
  // topK=2 keeps context lean — 2 chunks is enough to ground a 2-4 sentence reply
  let relevant: Awaited<ReturnType<typeof getChunksForMind>>
  const sbAvailable = await isSupabaseAvailable()
  if (sbAvailable) {
    relevant = deduplicateChunks(await querySupabase(mind.id, queryVec, 2, intent.topicLabel))
  } else {
    const allChunks = await getChunksForMind(mind.id)
    relevant = deduplicateChunks(topK(queryVec, allChunks, 2, intent))
  }

  // Truncate each chunk to ~80 words to keep context tokens low
  const truncate = (text: string, maxWords = 80) => {
    const words = text.split(/\s+/)
    return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '...' : text
  }
  const context = relevant.map(c => truncate(c.text)).join('\n\n')

  // Compact system prompt — every word costs tokens
  const systemPrompt = [
    mind.system || `You are ${mind.name}. Speak in their voice.`,
    context ? `Relevant source material:\n---\n${context}\n---\nGround your reply in this. Do not contradict it.` : '',
    'Reply in 2-3 sentences. No em dashes. End with [Source: <work>] if drawing from specific material.',
  ].filter(Boolean).join('\n\n')

  // Last 3 exchanges (6 messages) — enough context at minimal cost
  const recentHistory = history.slice(-6)
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
      max_tokens: 400,
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

// ── Streaming tier 1 — yields text tokens as they arrive ─────────────────────
async function* tier1Stream(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey: string,
  provider: string,
  model: string,
  embedOpts: EmbedOptions
): AsyncGenerator<string> {
  const queryVec = await embedQuery(userMessage, embedOpts)
  const intent = detectIntent(userMessage)

  let relevant: Awaited<ReturnType<typeof getChunksForMind>>
  const sbAvailable = await isSupabaseAvailable()
  if (sbAvailable) {
    relevant = deduplicateChunks(await querySupabase(mind.id, queryVec, 2, intent.topicLabel))
  } else {
    const allChunks = await getChunksForMind(mind.id)
    relevant = deduplicateChunks(topK(queryVec, allChunks, 2, intent))
  }

  const truncate = (text: string, maxWords = 80) => {
    const words = text.split(/\s+/)
    return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '...' : text
  }
  const context = relevant.map(c => truncate(c.text)).join('\n\n')

  const systemPrompt = [
    mind.system || `You are ${mind.name}. Speak in their voice.`,
    context ? `Relevant source material:\n---\n${context}\n---\nGround your reply in this. Do not contradict it.` : '',
    'Reply in 2-3 sentences. No em dashes. End with [Source: <work>] if drawing from specific material.',
  ].filter(Boolean).join('\n\n')

  const recentHistory = history.slice(-6)
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
      max_tokens: 400,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    throw new Error(`API error ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        // Anthropic streaming
        if (json.type === 'content_block_delta' && json.delta?.text) {
          yield json.delta.text
        }
        // OpenAI / OpenRouter streaming
        if (json.choices?.[0]?.delta?.content) {
          yield json.choices[0].delta.content
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

// ── Public streaming entry point ──────────────────────────────────────────────
export type StreamCallbacks = {
  onToken: (token: string) => void
  onDone: (result: ReplyResult) => void
  onError: (err: Error) => void
}

export async function ragReplyStream(
  mind: Mind,
  userMessage: string,
  history: Message[],
  apiKey: string | null,
  embedOpts: EmbedOptions,
  callbacks: StreamCallbacks,
  provider = 'anthropic',
  model = 'claude-haiku-4-5-20251001'
): Promise<void> {
  const [localIndexed, sbAvailable, sbIndexed] = await Promise.all([
    hasChunks(mind.id),
    isSupabaseAvailable(),
    isSupabaseAvailable().then(avail => avail ? hasChunksInSupabase(mind.id) : false),
  ])
  const indexed = localIndexed || sbIndexed

  if (apiKey && indexed) {
    try {
      let fullText = ''
      for await (const token of tier1Stream(mind, userMessage, history, apiKey, provider, model, embedOpts)) {
        fullText += token
        callbacks.onToken(token)
      }
      // Parse source tag from complete text
      const cleaned = stripEmDash(fullText.trim())
      const sourceMatch = cleaned.match(/\[Source:\s*([^\]]+)\]/)
      const source = sourceMatch ? sourceMatch[1].trim() : mind.name
      const reply = cleaned.replace(/\[Source:[^\]]+\]/g, '').trim()
      callbacks.onDone({ reply, source, engine: 'llm' })
      return
    } catch (err) {
      console.warn('Stream tier 1 failed, falling back:', err)
    }
  }

  // Non-streaming fallback for offline tiers
  try {
    const result = await ragReply(mind, userMessage, history, apiKey, embedOpts, provider, model)
    // Simulate streaming for consistent UX — emit whole reply at once
    callbacks.onToken(result.reply)
    callbacks.onDone(result)
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
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
