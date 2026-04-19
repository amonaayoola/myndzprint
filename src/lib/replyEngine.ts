import type { Mind, Message, BrainReply } from '../types'

// ── CONTEXT ─────────────────────────────────────────────────────────────────
interface ReplyContext {
  repliesUsed: Record<string, number[]>
  entitiesMentioned: string[]
}

function newContext(): ReplyContext {
  return { repliesUsed: {}, entitiesMentioned: [] }
}

function extractEntities(text: string): string[] {
  const words = text.split(/\s+/)
  return words.filter(w => w.length > 3 && /^[A-Z]/.test(w) && w === w.charAt(0).toUpperCase() + w.slice(1))
}

export function contextFromHistory(history: Message[], mind: Mind): ReplyContext {
  const ctx = newContext()
  for (const m of history) {
    if (m.role === 'user') {
      const ents = extractEntities(m.content)
      for (const e of ents) {
        if (!ctx.entitiesMentioned.includes(e)) ctx.entitiesMentioned.unshift(e)
      }
    }
  }
  ctx.entitiesMentioned = ctx.entitiesMentioned.slice(0, 12)
  if (mind.brain) {
    for (const m of history) {
      if (m.role !== 'assistant') continue
      mind.brain.forEach((entry, idx) => {
        entry.replies.forEach((reply, rIdx) => {
          const baseText = reply.t.replace(/\{entity\}/g, '').trim().slice(0, 40)
          if (baseText.length < 10) return
          if (m.content.includes(baseText)) {
            const key = entry.keys[0] === '__redirect__' ? '__redirect__' : String(idx)
            if (!ctx.repliesUsed[key]) ctx.repliesUsed[key] = []
            if (!ctx.repliesUsed[key].includes(rIdx)) ctx.repliesUsed[key].push(rIdx)
          }
        })
      })
    }
  }
  return ctx
}

// ── FUZZY MATCHING ───────────────────────────────────────────────────────────
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const dp = Array.from({ length: a.length + 1 }, (_: unknown, i: number) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function fuzzyWordMatch(word: string, key: string): number {
  if (word === key) return 1
  if (key.includes(' ')) return word.includes(key) ? 0.9 : 0
  if (key.length < 4 || word.length < 4) return 0
  const dist = editDistance(word, key)
  const maxLen = Math.max(word.length, key.length)
  const similarity = 1 - dist / maxLen
  const tolerance = key.length <= 6 ? 1 : 2
  return dist <= tolerance ? similarity * 0.8 : 0
}

function scoreEntry(entry: { keys: string[]; weight?: number }, lower: string): number {
  let score = 0
  const weight = entry.weight ?? 1
  const words = lower.trim().split(/\s+/)
  for (const key of entry.keys) {
    const k = key.toLowerCase()
    if (k.includes(' ')) {
      if (lower.includes(k)) { score += 10 * weight; continue }
      const kWords = k.split(/\s+/)
      const hits = kWords.filter(kw => words.some(w => fuzzyWordMatch(w, kw) > 0.7))
      if (hits.length >= Math.ceil(kWords.length * 0.7)) score += 6 * weight
      continue
    }
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp('\\b' + escaped + '\\b', 'i')
    if (re.test(lower)) {
      score += k.length >= 7 ? 3 * weight : k.length >= 5 ? 2 * weight : 1 * weight
      continue
    }
    let bestFuzz = 0
    for (const w of words) {
      const fuzz = fuzzyWordMatch(w, k)
      if (fuzz > bestFuzz) bestFuzz = fuzz
    }
    if (bestFuzz > 0.7) score += bestFuzz * (k.length >= 7 ? 2.5 : 1.5) * weight
  }
  return score
}

// ── BRAIN MATCHING ────────────────────────────────────────────────────────────
function matchLocalBrain(mind: Mind, message: string, ctx: ReplyContext): BrainReply | null {
  if (!mind.brain || mind.brain.length === 0) return null
  const lower = ' ' + message.toLowerCase().replace(/[,.!?;:'"()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  if (lower.length < 3) return null

  const scored: { entryIdx: number; score: number }[] = []
  mind.brain.forEach((entry, idx) => {
    if (entry.keys[0] === '__redirect__') return
    const score = scoreEntry(entry, lower)
    if (score > 0) scored.push({ entryIdx: idx, score })
  })
  if (scored.length === 0) return null

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aUsed = (ctx.repliesUsed[a.entryIdx] || []).length
    const bUsed = (ctx.repliesUsed[b.entryIdx] || []).length
    return aUsed - bUsed
  })

  const best = scored[0]
  const entry = mind.brain[best.entryIdx]
  const used = ctx.repliesUsed[best.entryIdx] || []
  let pickIdx = 0
  for (let i = 0; i < entry.replies.length; i++) {
    if (!used.includes(i)) { pickIdx = i; break }
    pickIdx = i
  }
  if (used.length >= entry.replies.length) {
    pickIdx = used[0] == null ? 0 : used[0]
    ctx.repliesUsed[best.entryIdx] = []
  }
  ctx.repliesUsed[best.entryIdx] = [...(ctx.repliesUsed[best.entryIdx] || []), pickIdx]
  return entry.replies[pickIdx]
}

function getRedirect(mind: Mind, _message: string, ctx: ReplyContext): BrainReply | null {
  const fallback = (mind.brain || []).find(e => e.keys.length === 1 && e.keys[0] === '__redirect__')
  if (!fallback) return null
  const recentEntity = ctx.entitiesMentioned[0]
  const used = ctx.repliesUsed['__redirect__'] || []
  let pickIdx = 0
  for (let i = 0; i < fallback.replies.length; i++) {
    if (!used.includes(i)) { pickIdx = i; break }
  }
  if (used.length >= fallback.replies.length) {
    ctx.repliesUsed['__redirect__'] = []
    pickIdx = 0
  }
  ctx.repliesUsed['__redirect__'] = [...used, pickIdx]
  const reply = fallback.replies[pickIdx]
  const text = recentEntity
    ? reply.t.replace(/\{entity\}/g, recentEntity)
    : reply.t.replace(/\{entity\}/g, 'what you said')
  return { t: text, s: reply.s }
}

// ── SYNONYM EXPANSION ─────────────────────────────────────────────────────────
const SYNONYM_CLUSTERS = [
  { seeds: ['sad', 'unhappy', 'miserable', 'down', 'hopeless', 'grief', 'grieve', 'mourning', 'mourn', 'heartbroken', 'heartbreak', 'depressed', 'depression', 'loss', 'lost', 'hurting', 'hurt'], map: ['suffering', 'sadness', 'loss', 'grief', 'pain', 'hardship', 'going through', 'depressed', 'depression'] },
  { seeds: ['happy', 'joy', 'joyful', 'content', 'elated', 'grateful', 'gratitude', 'blessed', 'peace', 'peaceful'], map: ['joy', 'happiness', 'gratitude', 'contentment', 'peace'] },
  { seeds: ['afraid', 'scared', 'fear', 'terrified', 'nervous', 'anxious', 'anxiety', 'worry', 'worried', 'dread'], map: ['fear', 'courage', 'anxiety', 'anxious'] },
  { seeds: ['angry', 'rage', 'furious', 'mad', 'outrage', 'resentment', 'resentful', 'bitter', 'bitterness'], map: ['anger', 'bitterness', 'rage', 'furious', 'angry'] },
  { seeds: ['lonely', 'alone', 'isolated', 'invisible', 'unseen', 'disconnected', 'abandoned'], map: ['lonely', 'loneliness', 'alone', 'solitude'] },
  { seeds: ['purpose', 'meaning', 'meaningless', 'direction', 'lost my way', 'why am i here', 'point', 'pointless', 'void'], map: ['purpose', 'meaning', 'meaningless', 'direction', 'life', 'what should i do'] },
  { seeds: ['boss', 'manager', 'team', 'office', 'work', 'career', 'job', 'colleague', 'leader', 'leadership'], map: ['leadership', 'power', 'authority', 'responsibility'] },
  { seeds: ['father', 'mother', 'parent', 'parents', 'family', 'child', 'children', 'son', 'daughter', 'brother', 'sister', 'sibling'], map: ['family', 'children', 'father', 'mother', 'relationship'] },
  { seeds: ['love', 'romance', 'relationship', 'partner', 'girlfriend', 'boyfriend', 'spouse', 'wife', 'husband', 'dating', 'heartbreak'], map: ['love', 'relationship', 'marriage', 'women', 'loneliness'] },
  { seeds: ['money', 'wealth', 'rich', 'poor', 'poverty', 'finance', 'financial', 'income', 'debt', 'broke'], map: ['money', 'poverty', 'wealth', 'economy', 'inequality'] },
  { seeds: ['fail', 'failure', 'mistake', 'regret', 'regrets', 'shame', 'embarrass', 'wrong', 'mess', 'screwed up'], map: ['failure', 'regret', 'mistake', 'shame', 'hardship'] },
  { seeds: ['god', 'religion', 'faith', 'spiritual', 'believe', 'belief', 'church', 'prayer', 'pray', 'divine', 'soul'], map: ['god', 'religion', 'faith', 'spiritual', 'belief', 'meaning'] },
  { seeds: ['die', 'death', 'dying', 'dead', 'mortality', 'mortal', 'end', 'afterlife', 'legacy'], map: ['death', 'mortality', 'legacy', 'dying', 'fear'] },
  { seeds: ['freedom', 'free', 'liberation', 'oppression', 'justice', 'injustice', 'rights', 'equality', 'inequality'], map: ['freedom', 'justice', 'liberation', 'rights', 'equality'] },
  { seeds: ['power', 'control', 'authority', 'government', 'politics', 'politician', 'democracy', 'corruption'], map: ['power', 'authority', 'leadership', 'government', 'politics'] },
  { seeds: ['grow', 'change', 'become', 'better', 'improve', 'evolve', 'transform', 'reinvent'], map: ['growth', 'change', 'becoming', 'transformation', 'self-improvement'] },
  { seeds: ['write', 'writing', 'create', 'creative', 'creativity', 'art', 'express', 'expression'], map: ['writing', 'creativity', 'art', 'expression', 'voice'] },
  { seeds: ['learn', 'knowledge', 'wisdom', 'education', 'school', 'read', 'reading', 'books', 'study'], map: ['wisdom', 'learning', 'education', 'knowledge', 'books'] },
  { seeds: ['strong', 'strength', 'resilience', 'resilient', 'endure', 'survive', 'persevere', 'tough', 'overcome'], map: ['strength', 'resilience', 'endurance', 'overcome', 'perseverance'] },
  { seeds: ['time', 'slow down', 'fast', 'busy', 'rest', 'pause', 'patience', 'patient'], map: ['time', 'patience', 'presence', 'solitude'] },
  { seeds: ['help', 'advice', 'guidance', 'what should i', 'how do i', 'how can i'], map: ['advice', 'what should i do', 'guidance', 'help'] },
]

function expandQuery(message: string): string {
  const lower = message.toLowerCase()
  const extra: string[] = []
  for (const cluster of SYNONYM_CLUSTERS) {
    if (cluster.seeds.some(s => lower.includes(s))) {
      extra.push(...cluster.map)
    }
  }
  return lower + ' ' + extra.join(' ')
}

// ── CORPUS RETRIEVAL ────────────────────────────────────────────────────────
const STOPWORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'have', 'they', 'what', 'when', 'where', 'your', 'will', 'been', 'were', 'would', 'could', 'should', 'their', 'them', 'there', 'these', 'those', 'which', 'while', 'about', 'than', 'then', 'into', 'upon', 'over', 'such'])

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
}

const CORPUS_BRIDGE_PREFIXES = ['', 'On this: ', 'What comes to mind: ', 'I have written about this. ', 'Let me say it plainly. ', 'Here is what I know of it. ']

function corpusFallback(mind: Mind, message: string): BrainReply | null {
  const corpus = mind.corpus || ''
  if (!corpus) return null

  const sentences = corpus.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 320)
  if (sentences.length === 0) return null

  const expanded = expandQuery(message)
  const qTokens = tokenize(expanded).filter(t => !STOPWORDS.has(t) && t.length >= 3)
  if (qTokens.length === 0) {
    const pick = sentences[Math.floor(Math.random() * Math.min(sentences.length, 8))]
    return { t: pick, s: mind.name }
  }

  const scored = sentences.map(s => {
    const sTokens = new Set(tokenize(s))
    let score = 0
    for (const qt of qTokens) {
      if (sTokens.has(qt)) score += 2
      for (const st of sTokens) {
        if (st.length > 4 && (st.startsWith(qt) || qt.startsWith(st))) score += 0.5
      }
    }
    return { s, score }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { t: sentences[0], s: mind.name }

  const top = scored[0].s
  let reply = top
  if (scored.length > 1 && top.length < 180 && scored[1].score >= scored[0].score * 0.7) {
    reply = top + ' ' + scored[1].s
  }

  const prefix = CORPUS_BRIDGE_PREFIXES[Math.floor(Math.random() * CORPUS_BRIDGE_PREFIXES.length)]
  return { t: prefix + reply, s: mind.name }
}

// ── CHUNK / RETRIEVE FOR API ─────────────────────────────────────────────────
function chunkText(text: string, targetSize = 400): string[] {
  const paragraphs = text.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > targetSize && current) {
      chunks.push(current)
      current = p
    } else {
      current = current ? current + '\n\n' + p : p
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function scoreChunks(query: string, chunks: string[]): { chunk: string; score: number }[] {
  const qTokens = tokenize(query).filter(t => !STOPWORDS.has(t))
  if (qTokens.length === 0) return []
  return chunks.map(chunk => {
    const cTokens = tokenize(chunk)
    const cSet = new Set(cTokens)
    let score = 0
    for (const qt of qTokens) {
      if (cSet.has(qt)) score += 1
      for (const ct of cSet) {
        if (ct.length > 4 && (ct.startsWith(qt) || qt.startsWith(ct))) score += 0.3
      }
    }
    return { chunk, score }
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score)
}

export function retrieveContext(query: string, corpus: string, { maxChars = 2000, topK = 4 } = {}): string {
  if (!corpus) return ''
  if (corpus.length <= 5000) return corpus
  const chunks = chunkText(corpus, 400)
  const scored = scoreChunks(query, chunks).slice(0, topK)
  if (scored.length === 0) return chunks[0] || ''
  let out = ''
  for (const s of scored) {
    if (out.length + s.chunk.length > maxChars) break
    out += (out ? '\n\n' : '') + s.chunk
  }
  return out
}

// ── LOCAL REPLY ───────────────────────────────────────────────────────────────
export interface ReplyResult {
  reply: string
  source?: string
  engine: 'local' | 'llm'
}

export function localReply(mind: Mind, message: string, history: Message[]): ReplyResult {
  const ctx = contextFromHistory(history, mind)

  const match = matchLocalBrain(mind, message, ctx)
  if (match) return { reply: match.t, source: match.s, engine: 'local' }

  const expanded = expandQuery(message)
  if (expanded !== message.toLowerCase()) {
    const expandedMatch = matchLocalBrain(mind, expanded, ctx)
    if (expandedMatch) return { reply: expandedMatch.t, source: expandedMatch.s, engine: 'local' }
  }

  const fromCorpus = corpusFallback(mind, message)
  if (fromCorpus) return { reply: fromCorpus.t, source: fromCorpus.s, engine: 'local' }

  const redirect = getRedirect(mind, message, ctx)
  if (redirect) return { reply: redirect.t, source: redirect.s, engine: 'local' }

  return { reply: 'I do not have words for this. Say more.', engine: 'local' }
}
