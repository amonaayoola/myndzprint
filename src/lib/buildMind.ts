import type { Mind } from '../types'

const STOPWORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'have', 'they', 'what', 'when', 'where', 'your', 'will', 'been', 'were', 'would', 'could', 'should', 'their', 'them', 'there', 'these', 'those', 'which', 'while', 'about', 'than', 'then', 'into', 'upon', 'over', 'such'])

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
}

export function buildMindLocally(params: {
  id: string
  name: string
  era: string
  type: string
  description: string
  sourceText: string
}): Mind {
  const { id, name, era, type, description, sourceText } = params

  const combined = (description + '\n\n' + sourceText).toLowerCase()
  const tokens = tokenize(combined).filter(t => !STOPWORDS.has(t) && t.length >= 4)
  const freq: Record<string, number> = {}
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1
  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w)

  const sentences = (sourceText || description)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 240)

  const takeSentence = () => (sentences.length ? sentences.shift() : null)

  const brain: Mind['brain'] = []

  brain.push({
    keys: ['hello', 'hi', 'hey', 'good morning'],
    topic: 'greeting',
    weight: 1,
    replies: [
      { t: `${name}. ${takeSentence() || description.split(/[.!?]/)[0] || 'Ask what you came to ask.'}`, s: 'Personal' },
      { t: 'Hello. What brings you?', s: 'Personal' },
    ],
  })

  if (description) {
    brain.push({
      keys: ['your life', 'about you', 'tell me about yourself', 'life story', 'who are you'],
      topic: 'biography',
      weight: 2,
      replies: [{ t: description.slice(0, 300), s: 'Personal' }],
    })
  }

  const used = new Set<string>()
  for (const kw of topKeywords) {
    if (brain.length >= 10) break
    if (used.has(kw)) continue
    const match = sentences.find(s => s.toLowerCase().includes(kw) && !used.has('S:' + s))
    if (!match) continue
    used.add('S:' + match)
    used.add(kw)
    brain.push({
      keys: [kw],
      topic: kw,
      weight: 2,
      replies: [{ t: match, s: 'Source' }],
    })
  }

  brain.push({
    keys: ['are you real', 'are you ai', 'are you a bot', 'chatbot'],
    topic: 'meta',
    weight: 4,
    replies: [
      { t: `I am a print of ${name}, not the person. What speaks to you is a pattern made from the material you provided. Use it thoughtfully.`, s: 'Personal' },
    ],
  })

  brain.push({
    keys: ['__redirect__'],
    topic: 'redirect',
    replies: [
      { t: 'I do not have a ready answer for that. Tell me the specific case and I will try to meet you there.', s: 'Personal' },
      { t: 'You mentioned {entity}. Often the thing we skip is the thing we came for. Say more.', s: 'Personal' },
      { t: 'That is outside what I have said directly. But what is underneath the question? Start there.', s: 'Personal' },
    ],
  })

  const firstSent = sentences[0] || description.split(/[.!?]/)[0] || ''
  const opening = firstSent
    ? `I am ${name}. ${firstSent.slice(0, 180)}. What brings you here?`
    : `I am ${name}. ${description.slice(0, 140) || 'Ask me anything.'} What brings you here?`

  const tags = topKeywords.slice(0, 3).map(t => t.charAt(0).toUpperCase() + t.slice(1))
  if (tags.length === 0) tags.push(type === 'personal' ? 'Personal' : 'Custom')

  return {
    id,
    name,
    initial: name.charAt(0).toUpperCase(),
    domain: type === 'personal' ? 'Personal' : type === 'community' ? 'Community' : 'Custom',
    era,
    type: type as Mind['type'],
    quote: firstSent ? firstSent.slice(0, 120) : description.slice(0, 100),
    opening,
    tags,
    system: `You are ${name}. ${description}`,
    corpus: sourceText || '',
    brain,
  }
}
