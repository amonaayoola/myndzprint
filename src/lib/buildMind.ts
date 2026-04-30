import type { Mind } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its',
  'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from',
  'have', 'they', 'what', 'when', 'where', 'your', 'will', 'been', 'were',
  'would', 'could', 'should', 'their', 'them', 'there', 'these', 'those',
  'which', 'while', 'about', 'than', 'then', 'into', 'upon', 'over', 'such',
  'more', 'also', 'just', 'like', 'some', 'very', 'only', 'even', 'most',
  'much', 'well', 'after', 'before', 'being', 'each', 'every', 'first',
  'great', 'here', 'made', 'make', 'many', 'must', 'other', 'same', 'through',
])

// Theme keyword clusters for thematic extraction
const THEME_CLUSTERS: Record<string, string[]> = {
  philosophy: ['truth', 'knowledge', 'wisdom', 'reason', 'mind', 'thought', 'think', 'understand', 'reality', 'existence', 'belief', 'rational', 'logic', 'nature', 'principle', 'idea', 'philosophy', 'doctrine', 'virtue', 'moral'],
  suffering: ['pain', 'suffer', 'hardship', 'struggle', 'difficulty', 'trial', 'burden', 'loss', 'grief', 'sorrow', 'endure', 'overcome', 'adversity', 'dark', 'hard', 'wound', 'tragedy', 'misfortune'],
  purpose: ['purpose', 'meaning', 'goal', 'mission', 'calling', 'destiny', 'path', 'direction', 'reason', 'aim', 'quest', 'vision', 'pursue', 'seek', 'strive', 'aspire'],
  love: ['love', 'heart', 'relationship', 'family', 'friendship', 'bond', 'connection', 'together', 'companion', 'beloved', 'affection', 'care', 'devotion', 'tenderness', 'intimate'],
  work: ['work', 'craft', 'discipline', 'effort', 'labor', 'practice', 'skill', 'dedicate', 'commit', 'create', 'build', 'master', 'art', 'profession', 'vocation', 'diligence', 'persevere'],
  death: ['death', 'die', 'mortality', 'legacy', 'remember', 'end', 'final', 'eternal', 'afterlife', 'soul', 'spirit', 'immortal', 'perish', 'grave', 'cease', 'pass'],
  happiness: ['happy', 'happiness', 'joy', 'content', 'peace', 'calm', 'serenity', 'flourish', 'thrive', 'delight', 'pleasure', 'satisfy', 'fulfill', 'bless', 'gratitude', 'enough'],
  advice: ['must', 'should', 'ought', 'never', 'always', 'remember', 'learn', 'teach', 'lesson', 'advice', 'counsel', 'guide', 'wisdom', 'important', 'essential', 'crucial'],
  self: ['myself', 'yourself', 'character', 'identity', 'who', 'inner', 'soul', 'person', 'individual', 'human', 'nature', 'habit', 'virtue', 'flaw', 'weakness', 'strength'],
  society: ['society', 'people', 'world', 'history', 'culture', 'civilization', 'nation', 'community', 'generation', 'time', 'age', 'era', 'century', 'human', 'mankind'],
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
}

/**
 * Extract the top N sentences most relevant to a given set of theme keywords.
 * Scores each sentence by weighted keyword match + synonym coverage.
 */
export function extractThematic(sentences: string[], themeKeywords: string[], topN: number): string[] {
  const filtered = sentences.filter(s => s.length >= 20 && s.length <= 300)
  if (filtered.length === 0) return []

  const scored = filtered.map(s => {
    const lower = s.toLowerCase()
    const words = tokenize(lower)
    let score = 0
    for (const kw of themeKeywords) {
      const kwLower = kw.toLowerCase()
      if (lower.includes(kwLower)) score += 3
      for (const w of words) {
        if (w.startsWith(kwLower.slice(0, 5)) && kwLower.length >= 5) score += 1
      }
    }
    // Prefer sentences of moderate length (60-180 chars) — more quotable
    const lenBonus = s.length >= 60 && s.length <= 180 ? 2 : 0
    // Prefer sentences that start with "I" — more personal/voiced
    const voiceBonus = s.trimStart().charAt(0) === 'I' ? 1 : 0
    return { s, score: score + lenBonus + voiceBonus }
  })

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(x => x.s)
}

/**
 * Detect the voice style from source text.
 * Returns a style tag and an instruction string for use in system prompts.
 */
export function detectVoice(sourceText: string): { style: 'formal' | 'aphoristic' | 'narrative', instruction: string } {
  if (!sourceText || sourceText.trim().length < 100) {
    return { style: 'formal', instruction: 'Speak with measured authority. Be thoughtful and complete.' }
  }

  const sentences = sourceText.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const avgLen = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1)

  // Count first-person past tense markers
  const narrativeMarkers = (sourceText.match(/\b(I was|I had|I felt|I knew|I went|I saw|I learned|I found|I became)\b/gi) || []).length
  // Count imperative/short aphoristic patterns
  const aphoristicMarkers = (sourceText.match(/\b(never|always|do not|do not|must|remember|one must|you must|let)\b/gi) || []).length
  // Count abstract philosophical nouns
  const philosophicalMarkers = (sourceText.match(/\b(truth|wisdom|virtue|nature|reason|soul|existence|reality|principle|justice)\b/gi) || []).length

  const narrativeScore = narrativeMarkers * 2
  const aphoristicScore = aphoristicMarkers * 2 + (avgLen < 15 ? 5 : 0)
  const formalScore = philosophicalMarkers * 2 + (avgLen > 25 ? 5 : 0)

  if (narrativeScore >= aphoristicScore && narrativeScore >= formalScore && narrativeScore > 2) {
    return {
      style: 'narrative',
      instruction: 'Draw on personal experience and memory. Speak in first person, past and present. Ground your answers in specific events, encounters, or moments you witnessed.',
    }
  }
  if (aphoristicScore >= formalScore && aphoristicScore > 2) {
    return {
      style: 'aphoristic',
      instruction: 'Be direct and punchy. Prefer short declarative sentences. Speak in maxims where possible. Never waste a word.',
    }
  }
  return {
    style: 'formal',
    instruction: 'Speak with measured weight and philosophical depth. Use complete, considered sentences. Never be glib.',
  }
}

/**
 * Find the single most quotable sentence from a corpus.
 * Prefers 40-120 chars, high keyword density, declarative.
 */
function extractBestQuote(sentences: string[], topKeywords: string[]): string {
  const candidates = sentences.filter(s => s.length >= 40 && s.length <= 140)
  if (candidates.length === 0) return sentences.find(s => s.length >= 20)?.slice(0, 120) || ''

  const scored = candidates.map(s => {
    const lower = s.toLowerCase()
    let score = 0
    for (const kw of topKeywords) {
      if (lower.includes(kw)) score += 2
    }
    // Penalise questions (we want statements as quotes)
    if (s.endsWith('?')) score -= 3
    // Prefer sentences that begin with a strong word
    if (/^(The|Life|To|We|There|It|Nothing|All|Every|No|In|A great|What|Man|One)/.test(s)) score += 2
    // Prefer medium length — not too short, not too long
    if (s.length >= 50 && s.length <= 100) score += 2
    return { s, score }
  })

  return scored.sort((a, b) => b.score - a.score)[0]?.s || candidates[0] || ''
}

/**
 * Build a generic reply for a topic when no source sentences match.
 * Uses name and topic to produce an in-character stub.
 */
function fallbackReply(name: string, topic: string): string {
  const stubs: Record<string, string> = {
    greeting: `I am ${name}. Come, ask what you came to ask.`,
    suffering: `Suffering is not the exception — it is the condition. What matters is what you do inside it.`,
    purpose: `Purpose is not found. It is built — choice by choice, day by day.`,
    love: `What we love shapes us more than what we believe. Choose carefully.`,
    work: `Discipline is not punishment. It is the form love takes when directed at craft.`,
    death: `The end is certain. The path before it is not. What will you do with the path?`,
    happiness: `Contentment is not the absence of difficulty. It is the presence of meaning.`,
    advice: `The most important things I have learned cannot be taught — only demonstrated.`,
    self: `Know what you are. Not what you wish to be — what you actually are. Then work.`,
    society: `We are not separate from the world we inhabit. We are its product, and it is ours.`,
    philosophy: `To think clearly is to act rightly. Start with the question, not the answer.`,
    redirect: `I cannot speak to that directly. Tell me more about what brought you to this question.`,
  }
  return stubs[topic] || `I have thought much about this. Tell me where you find yourself struggling with it.`
}

// ─── Main Local Build Function ────────────────────────────────────────────────

export function buildMindLocally(params: {
  id: string
  name: string
  era: string
  type: string
  description: string
  sourceText: string
}): Mind {
  const { id, name, era, type, description, sourceText } = params

  // ── 1. Parse sentences from all available text ──────────────────────────────
  const fullText = [description, sourceText].filter(Boolean).join('\n\n')
  const rawSentences = fullText
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300)

  // ── 2. Compute keyword frequencies ──────────────────────────────────────────
  const combined = fullText.toLowerCase()
  const tokens = tokenize(combined).filter(t => !STOPWORDS.has(t) && t.length >= 4)
  const freq: Record<string, number> = {}
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1
  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w)

  // ── 3. Detect voice style ────────────────────────────────────────────────────
  const voice = detectVoice(sourceText || description)

  // ── 4. Extract thematic sentences for each topic area ───────────────────────
  const thematic: Record<string, string[]> = {}
  for (const [theme, keywords] of Object.entries(THEME_CLUSTERS)) {
    thematic[theme] = extractThematic(rawSentences, keywords, 5)
  }

  // ── 5. Best quote and opening ────────────────────────────────────────────────
  const bestQuote = rawSentences.length > 0
    ? extractBestQuote(rawSentences, topKeywords)
    : description.slice(0, 120)

  const firstImpactSentence = rawSentences.find(s => s.length >= 40 && s.length <= 200) || rawSentences[0] || description

  const opening = era
    ? `I am ${name}. ${firstImpactSentence ? firstImpactSentence.slice(0, 180) + ' ' : ''}What brings you here?`
    : `I am ${name}. ${description.slice(0, 140) || 'Ask me anything.'} What brings you here?`

  // ── 6. Generate the system prompt ────────────────────────────────────────────
  const themeList = topKeywords.slice(0, 6).join(', ')
  const eraLine = era ? ` You lived in: ${era}.` : ''
  const typeLine = type === 'personal' ? ' This is a personal mind — speak intimately and directly.' : ''
  const system = `You are ${name}.${eraLine} ${description}

Core themes you return to: ${themeList}.

Voice and manner: ${voice.instruction}

When you answer, stay in character as ${name}. Draw on the specific ideas, events, and language from your source material rather than speaking generically. Be particular, not vague. Be honest, not reassuring. End each response with [Source: ${name}] or a specific work if known.${typeLine}

Do not break character. Do not say you are an AI unless the user specifically asks. If you do not know something, say so — but in your voice.`

  // ── 7. Build the brain ────────────────────────────────────────────────────────
  const brain: Mind['brain'] = []

  // ── Greetings (varied, in character) ────────────────────────────────────────
  brain.push({
    keys: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings', 'howdy'],
    topic: 'greeting',
    weight: 1,
    replies: [
      { t: `${name}. ${firstImpactSentence ? firstImpactSentence.slice(0, 140) + ' ' : ''}What brings you here?`, s: 'Personal' },
      { t: `Good. Most conversations begin with pleasantries. What is the real thing for you today?`, s: 'Personal' },
      { t: `I am here. Not the person exactly — but the mind shaped from their material. Ask what you came to ask.`, s: 'Personal' },
      { t: `Hello. I will not waste your time with ceremony. Say what you came to say.`, s: 'Personal' },
    ],
  })

  // ── Self-introduction / biography ───────────────────────────────────────────
  {
    const selfSentences = thematic.self.length > 0 ? thematic.self : rawSentences.slice(0, 3)
    const replies = selfSentences.slice(0, 2).map(s => ({ t: s.slice(0, 280), s: 'Personal' }))
    if (replies.length === 0) replies.push({ t: description.slice(0, 280) || fallbackReply(name, 'self'), s: 'Personal' })
    replies.push({ t: `I am ${name}. ${description.slice(0, 200)}`, s: 'Personal' })
    brain.push({
      keys: ['who are you', 'tell me about yourself', 'your story', 'life story', 'about you', 'introduce yourself', 'biography'],
      topic: 'biography',
      weight: 2,
      replies: replies.slice(0, 4),
    })
  }

  // ── Core philosophy / beliefs ───────────────────────────────────────────────
  {
    const philoSentences = thematic.philosophy
    const replies = philoSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) {
      replies.push({ t: fallbackReply(name, 'philosophy'), s: 'Personal' })
    }
    brain.push({
      keys: ['philosophy', 'believe', 'belief', 'worldview', 'values', 'principles', 'what do you believe', 'your philosophy', 'your view'],
      topic: 'philosophy',
      weight: 3,
      replies,
    })
  }

  // ── Life advice / wisdom ─────────────────────────────────────────────────────
  {
    const adviceSentences = thematic.advice
    const replies = adviceSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'advice'), s: 'Personal' })
    brain.push({
      keys: ['advice', 'wisdom', 'lesson', 'what should i do', 'guidance', 'counsel', 'teach me', 'what have you learned'],
      topic: 'wisdom',
      weight: 3,
      replies,
    })
  }

  // ── On suffering / hardship ──────────────────────────────────────────────────
  {
    const sufferSentences = thematic.suffering
    const replies = sufferSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'suffering'), s: 'Personal' })
    brain.push({
      keys: ['suffering', 'pain', 'hardship', 'struggle', 'difficult', 'hard times', 'loss', 'grief', 'sorrow', 'endure', 'overcome'],
      topic: 'suffering',
      weight: 3,
      replies,
    })
  }

  // ── On purpose / meaning ─────────────────────────────────────────────────────
  {
    const purposeSentences = thematic.purpose
    const replies = purposeSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'purpose'), s: 'Personal' })
    brain.push({
      keys: ['purpose', 'meaning', 'meaningless', 'point of life', 'why are we here', 'why bother', 'what is the point', 'calling', 'mission'],
      topic: 'purpose',
      weight: 3,
      replies,
    })
  }

  // ── On relationships / love ──────────────────────────────────────────────────
  {
    const loveSentences = thematic.love
    const replies = loveSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'love'), s: 'Personal' })
    brain.push({
      keys: ['love', 'relationship', 'family', 'friendship', 'heart', 'marriage', 'connection', 'people', 'community'],
      topic: 'relationships',
      weight: 2,
      replies,
    })
  }

  // ── On work / craft / discipline ─────────────────────────────────────────────
  {
    const workSentences = thematic.work
    const replies = workSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'work'), s: 'Personal' })
    brain.push({
      keys: ['work', 'discipline', 'practice', 'craft', 'effort', 'labor', 'dedication', 'habit', 'routine', 'create', 'build', 'skill'],
      topic: 'work',
      weight: 2,
      replies,
    })
  }

  // ── On death / legacy ────────────────────────────────────────────────────────
  {
    const deathSentences = thematic.death
    const replies = deathSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'death'), s: 'Personal' })
    brain.push({
      keys: ['death', 'die', 'dying', 'mortality', 'legacy', 'remembered', 'afterlife', 'end', 'fear death', 'afraid to die'],
      topic: 'death',
      weight: 3,
      replies,
    })
  }

  // ── On happiness / contentment ───────────────────────────────────────────────
  {
    const happySentences = thematic.happiness
    const replies = happySentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    if (replies.length < 2) replies.push({ t: fallbackReply(name, 'happiness'), s: 'Personal' })
    brain.push({
      keys: ['happiness', 'happy', 'joy', 'contentment', 'peace', 'fulfillment', 'satisfied', 'enough', 'flourish', 'good life'],
      topic: 'happiness',
      weight: 2,
      replies,
    })
  }

  // ── On their era / context ───────────────────────────────────────────────────
  if (era) {
    const societySentences = thematic.society
    const replies = societySentences.slice(0, 2).map(s => ({ t: s.slice(0, 280), s: 'Source' }))
    replies.push({ t: `I lived in ${era}. The world then was ${description.slice(0, 100)}. Much has changed; much has not.`, s: 'Personal' })
    brain.push({
      keys: ['your time', 'your era', 'history', 'historical context', 'when you lived', 'your world', 'your age', 'back then'],
      topic: 'context',
      weight: 1,
      replies: replies.slice(0, 3),
    })
  }

  // ── Keyword-driven entries from source text (top remaining keywords) ─────────
  const usedTopics = new Set(brain.map(b => b.topic))
  const usedSentences = new Set<string>()
  let extraCount = 0

  for (const kw of topKeywords) {
    if (extraCount >= 3 || brain.length >= 15) break
    if (usedTopics.has(kw)) continue

    const matchingSentences = extractThematic(rawSentences, [kw, ...topKeywords.slice(0, 5)], 4)
      .filter(s => !usedSentences.has(s))
    if (matchingSentences.length === 0) continue

    matchingSentences.forEach(s => usedSentences.add(s))
    brain.push({
      keys: [kw],
      topic: kw,
      weight: 2,
      replies: matchingSentences.slice(0, 3).map(s => ({ t: s.slice(0, 280), s: 'Source' })),
    })
    extraCount++
  }

  // ── Meta entry ────────────────────────────────────────────────────────────────
  brain.push({
    keys: ['are you real', 'are you ai', 'are you a bot', 'chatbot', 'artificial', 'llm', 'language model'],
    topic: 'meta',
    weight: 4,
    replies: [
      { t: `I am a print of ${name} — a pattern made from their words and ideas. Not the person. Use what speaks to you, and leave what does not.`, s: 'Personal' },
      { t: `That is a fair question. I am shaped from the material ${name} left behind. Whether that makes me real depends on what you mean by real.`, s: 'Personal' },
    ],
  })

  // ── Redirect entry (catch-all) ────────────────────────────────────────────────
  brain.push({
    keys: ['__redirect__'],
    topic: 'redirect',
    replies: [
      { t: `I cannot speak to that directly. Tell me more — what specifically brings you to this question?`, s: 'Personal' },
      { t: `That is outside what I have considered directly. But what is underneath the question? Start there.`, s: 'Personal' },
      { t: `I do not have a ready answer for that. Give me the specific case and I will try to meet you there.`, s: 'Personal' },
    ],
  })

  // ── 8. Tags ──────────────────────────────────────────────────────────────────
  const tags: string[] = topKeywords
    .slice(0, 5)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1))
    .filter(t => t.length >= 4)
    .slice(0, 4)

  if (tags.length === 0) {
    tags.push(type === 'personal' ? 'Personal' : 'Custom')
  }

  return {
    id,
    name,
    initial: name.charAt(0).toUpperCase(),
    domain: type === 'personal' ? 'Personal' : type === 'community' ? 'Community' : 'Custom',
    era,
    type: type as Mind['type'],
    quote: bestQuote.slice(0, 140),
    opening,
    tags,
    system,
    corpus: sourceText || '',
    brain,
  }
}
