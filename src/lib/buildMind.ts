import type { Mind } from '../types'

const STOPWORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'have', 'they', 'what', 'when', 'where', 'your', 'will', 'been', 'were', 'would', 'could', 'should', 'their', 'them', 'there', 'these', 'those', 'which', 'while', 'about', 'than', 'then', 'into', 'upon', 'over', 'such'])

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
}

// Extract top thematic sentences relevant to a keyword cluster
function extractThematic(sentences: string[], themeWords: string[], topN = 4): string[] {
  const scored = sentences.map(s => {
    const sl = s.toLowerCase()
    const score = themeWords.reduce((acc, w) => acc + (sl.includes(w) ? 1 : 0), 0)
    return { s, score }
  }).filter(x => x.score > 0 && x.s.length >= 30 && x.s.length <= 300)
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN).map(x => stripEmDash(x.s))
}

// Strip em dashes from any generated text
function stripEmDash(text: string): string {
  return text
    .replace(/\s*—\s*/g, '. ')   // em dash mid-sentence becomes a period + space
    .replace(/–/g, '-')           // en dash to hyphen
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export type VoiceStyle =
  | 'aphoristic'    // Short declarative statements, maxims, no filler
  | 'narrative'     // First-person storytelling, past-tense, personal memory
  | 'formal'        // Long structured sentences, academic/philosophical register
  | 'socratic'      // Question-heavy, turns answers back on the listener
  | 'poetic'        // Metaphor, imagery, rhythm, lyrical phrasing
  | 'coaching'      // Direct second-person imperatives, action-oriented
  | 'sarcastic'     // Dry wit, irony, understatement, rhetorical contrast
  | 'conversational'// Casual, relaxed, feels like talking to a friend
  | 'analytical'    // Breaks things down, lists causes/effects, precise
  | 'prophetic'     // Declarative certainty, warning tone, visionary
  | 'humorous'      // Jokes, wordplay, self-deprecating, light tone
  | 'confrontational'// Challenges the listener, pushes back, provocative
  | 'empathetic'    // Validates feelings first, warm, emotionally attuned
  | 'stoic'         // Controlled, sparse, no emotional excess, duty-focused

export interface VoiceProfile {
  style: VoiceStyle
  secondaryStyle: VoiceStyle | null   // runner-up style that also applies
  rhythm: 'short' | 'medium' | 'long'
  pronoun: 'I' | 'we' | 'you' | 'mixed'
  register: 'abstract' | 'concrete' | 'emotional' | 'balanced'
  traits: string[]
}

function detectVoice(sourceText: string): VoiceProfile {
  if (!sourceText || sourceText.trim().length < 50) {
    return {
      style: 'formal',
      secondaryStyle: null,
      rhythm: 'medium',
      pronoun: 'mixed',
      register: 'balanced',
      traits: ['thoughtful and measured in expression'],
    }
  }

  const rawSentences = sourceText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 8)
  const n = rawSentences.length || 1

  // ── Rhythm ────────────────────────────────────────────────────────────────
  const avgWords = rawSentences.map(s => s.split(/\s+/).length).reduce((a, b) => a + b, 0) / n
  const rhythm: VoiceProfile['rhythm'] = avgWords <= 11 ? 'short' : avgWords <= 22 ? 'medium' : 'long'

  // ── Pronoun pattern ───────────────────────────────────────────────────────
  const iCount   = (sourceText.match(/\bI\b/g) || []).length
  const weCount  = (sourceText.match(/\b(we|one|us)\b/gi) || []).length
  const youCount = (sourceText.match(/\byou\b/gi) || []).length
  const maxPron  = Math.max(iCount, weCount, youCount)
  const pronoun: VoiceProfile['pronoun'] =
    maxPron === 0 ? 'mixed' :
    iCount === maxPron && iCount > n * 0.12 ? 'I' :
    youCount === maxPron && youCount > n * 0.10 ? 'you' :
    weCount === maxPron && weCount > n * 0.08 ? 'we' : 'mixed'

  // ── Style scoring ─────────────────────────────────────────────────────────
  const scores: Record<VoiceStyle, number> = {
    aphoristic: 0, narrative: 0, formal: 0, socratic: 0,
    poetic: 0, coaching: 0, sarcastic: 0, conversational: 0,
    analytical: 0, prophetic: 0, humorous: 0, confrontational: 0,
    empathetic: 0, stoic: 0,
  }

  for (const s of rawSentences) {
    const st = s.trim()
    const sl = st.toLowerCase()
    const wc = st.split(/\s+/).length

    // Aphoristic
    if (wc <= 10 && !sl.startsWith('i ') && /^[A-Z]/.test(st) && !/\?$/.test(st)) scores.aphoristic += 1.2
    if (/^(never|always|nothing|everything|virtue|courage|death|time|life|love|truth|wisdom|power|freedom|the man|the woman|a man|a woman|great men|great women)/i.test(st)) scores.aphoristic += 0.9

    // Narrative
    if (/\b(i was|i had|i went|i saw|i knew|i remember|i felt|i learned|i found|when i|after i|before i|i once|i used to)\b/i.test(sl)) scores.narrative += 1.5
    if (/\b(years ago|at the time|one day|it was then|growing up|as a child|as a young|that night|that morning|back then)\b/i.test(sl)) scores.narrative += 1.3

    // Formal
    if (wc > 25) scores.formal += 0.8
    if (/\b(therefore|however|moreover|consequently|thus|wherein|inasmuch|henceforth|notwithstanding|aforementioned|insofar)\b/i.test(sl)) scores.formal += 1.8
    if (/\b(philosophy|reason|nature|essence|existence|consciousness|principle|universal|absolute|metaphysical|ontological|epistemological)\b/i.test(sl)) scores.formal += 1.1

    // Socratic
    if (/\?$/.test(st)) scores.socratic += 1.1
    if (/^(what|why|how|is it|have you|do you|can you|have we|does|which|who|when)/i.test(st) && /\?$/.test(st)) scores.socratic += 1.3
    if (/\b(consider|ask yourself|reflect|examine|think about|have you asked|what do you|what if)\b/i.test(sl)) scores.socratic += 1.0

    // Poetic
    if (wc <= 8 && /\b(like|breath|storm|fire|river|stone|shadow|light|dark|dust|blood|seed|root|wing|bone|earth|sky|rain|snow|sun|moon)\b/i.test(sl)) scores.poetic += 1.6
    if (/\b(sing|song|voice|silence|whisper|echo|pulse|beat|flow|rise|fall|ache|bloom|wither|weep|ache)\b/i.test(sl)) scores.poetic += 1.0
    if (/\.{3}$/.test(st)) scores.poetic += 0.6

    // Coaching
    if (/^(do |be |get |make |take |stop |start |try |go |keep |push |build |write |ask |show |give |find |set |run |stay |move |own |face |let |earn |decide |commit |choose |hold |stand |lead )/i.test(st)) scores.coaching += 1.6
    if (/\b(you need to|you must|you can|you should|your job|your role|your task|show up|level up|step up)\b/i.test(sl)) scores.coaching += 1.1

    // Sarcastic
    if (/\b(of course|obviously|clearly|naturally|surely|how wonderful|how fascinating|what a surprise|as if|right\b|yeah right|sure|brilliant|genius|perfect)\b/i.test(sl)) scores.sarcastic += 1.0
    if (/\b(how (very|quite|terribly|awfully|incredibly) (helpful|useful|original|brave|noble|wise|clever))\b/i.test(sl)) scores.sarcastic += 2.0
    if (/\b(because that('s| is) worked so well|nothing like|it('s| is) almost as if|perhaps|maybe one day|one might imagine)\b/i.test(sl)) scores.sarcastic += 1.3
    if (sl.includes('apparently') || sl.includes('supposedly') || sl.includes('allegedly')) scores.sarcastic += 0.8

    // Conversational
    if (/\b(look|listen|okay|so here|thing is|you know|honestly|basically|right\?|kind of|sort of|i mean|anyway|here'?s the thing|by the way)\b/i.test(sl)) scores.conversational += 1.4
    if (wc >= 5 && wc <= 15 && pronoun === 'mixed' && !/\?$/.test(st)) scores.conversational += 0.5
    if (/\b(it'?s|don'?t|can'?t|won'?t|isn'?t|wasn'?t|aren'?t|haven'?t|didn'?t|doesn'?t|i'?m|i'?ve|i'?ll|they'?re|we'?re)\b/i.test(sl)) scores.conversational += 0.7

    // Analytical
    if (/\b(first|second|third|because|therefore|the reason|the cause|the effect|this means|which means|as a result|in other words|to put it)\b/i.test(sl)) scores.analytical += 1.2
    if (/\b(data|evidence|research|studies show|statistic|pattern|system|structure|mechanism|factor|variable|correlation)\b/i.test(sl)) scores.analytical += 1.5
    if (wc > 18 && /,/.test(st)) scores.analytical += 0.5

    // Prophetic
    if (/\b(will come|shall|the day will|there will be|mark my words|what is coming|a time will|the world will|they will|it will|you will see|beware|the hour|the reckoning|rise|fall of)\b/i.test(sl)) scores.prophetic += 1.4
    if (/^(beware|know this|hear me|listen well|the time|a day|the end|the beginning|soon)/i.test(st)) scores.prophetic += 1.2

    // Humorous
    if (/!$/.test(st) && wc <= 12) scores.humorous += 0.5
    if (/\b(hilarious|ridiculous|absurd|comedy|joke|funny|laugh|irony|ridiculous|preposterous|nonsense|silly|mad|crazy|wild)\b/i.test(sl)) scores.humorous += 1.0
    if (/\b(apparently|supposedly|legend has it|they say|rumor has it|who knew|go figure|believe it or not)\b/i.test(sl)) scores.humorous += 0.7

    // Confrontational
    if (/^(wrong|no\.|stop\.|that'?s (wrong|false|absurd|naive|weak)|you'?re (wrong|mistaken|deluding|fooling)|let me be (direct|blunt|clear|honest)|actually|in fact|contrary to)/i.test(st)) scores.confrontational += 1.5
    if (/\b(you are wrong|that is false|that is naive|stop pretending|face it|admit it|be honest|you know it|the truth is you|refusing to see)\b/i.test(sl)) scores.confrontational += 1.3

    // Empathetic
    if (/\b(i understand|i hear you|that must|it makes sense|of course you|it'?s okay|you'?re not alone|that'?s hard|i know how|i feel|i see you|what you'?re feeling|your pain|your struggle)\b/i.test(sl)) scores.empathetic += 1.6
    if (/\b(when we hurt|when we lose|when we feel|grief|loss|healing|safe|held|seen|heard|validated|not easy|not simple)\b/i.test(sl)) scores.empathetic += 1.0

    // Stoic
    if (/\b(duty|obligation|discipline|control what|cannot control|endure|accept|indifferent|regardless|despite|nonetheless|what must be|bear it|carry on|do what must)\b/i.test(sl)) scores.stoic += 1.3
    if (wc <= 14 && !/\?$/.test(st) && !sl.includes('i feel') && !sl.includes('love') && pronoun !== 'I') scores.stoic += 0.5
    if (/\b(virtue|reason|nature|will|judgment|impression|assent|impulse|desire|aversion)\b/i.test(sl)) scores.stoic += 0.9
  }

  // Normalize
  for (const k of Object.keys(scores) as VoiceStyle[]) {
    scores[k] = scores[k] / n
  }

  const sorted = (Object.entries(scores) as [VoiceStyle, number][]).sort((a, b) => b[1] - a[1])
  const style = sorted[0][0]
  const secondaryStyle = sorted[1][1] > sorted[0][1] * 0.6 ? sorted[1][0] : null

  // ── Register ──────────────────────────────────────────────────────────────
  const abstractWords  = (sourceText.match(/\b(truth|virtue|justice|reason|principle|meaning|essence|existence|nature|universal|freedom|soul|spirit|consciousness|morality|duty|honor|wisdom|knowledge|belief)\b/gi) || []).length
  const concreteWords  = (sourceText.match(/\b(work|build|make|act|move|step|hand|foot|eye|door|road|fire|water|stone|body|money|child|family|city|book|letter|word|day|night|year|hour)\b/gi) || []).length
  const emotionalWords = (sourceText.match(/\b(feel|love|fear|hope|grief|anger|joy|pain|suffer|hurt|cry|laugh|miss|long|desire|hate|shame|proud|brave|afraid|alone|lost|broken|healed)\b/gi) || []).length
  const maxReg = Math.max(abstractWords, concreteWords, emotionalWords)
  const register: VoiceProfile['register'] =
    maxReg === 0 ? 'balanced' :
    abstractWords === maxReg ? 'abstract' :
    emotionalWords === maxReg ? 'emotional' :
    concreteWords === maxReg ? 'concrete' : 'balanced'

  // ── Trait labels ──────────────────────────────────────────────────────────
  const styleTraits: Record<VoiceStyle, string> = {
    aphoristic:      'speaks in short, precise maxims with no filler',
    narrative:       'speaks through personal story and lived experience',
    formal:          'uses structured, measured language with careful argumentation',
    socratic:        'asks probing questions rather than giving direct answers',
    poetic:          'speaks in metaphor, image, and rhythm',
    coaching:        'gives direct second-person direction and actionable guidance',
    sarcastic:       'uses dry wit, irony, and understatement to make points',
    conversational:  'speaks in a relaxed, natural, friend-to-friend register',
    analytical:      'breaks problems into causes and effects, precise and systematic',
    prophetic:       'speaks with declarative certainty and visionary urgency',
    humorous:        'uses humor, wordplay, and lightness to connect and disarm',
    confrontational: 'challenges assumptions directly and pushes back without apology',
    empathetic:      'acknowledges feelings first and speaks from emotional attunement',
    stoic:           'controlled and sparse, focused on duty and what can be controlled',
  }

  const traits: string[] = [styleTraits[style]]
  if (secondaryStyle) traits.push(`also tends toward: ${styleTraits[secondaryStyle]}`)

  if (rhythm === 'short') traits.push('favors short, punchy sentences')
  if (rhythm === 'long')  traits.push('builds meaning through long, layered sentences')

  if (pronoun === 'I')   traits.push('speaks from personal experience in first person')
  if (pronoun === 'you') traits.push('addresses the listener directly and personally')
  if (pronoun === 'we')  traits.push('frames experience as shared and collective')

  if (register === 'abstract')  traits.push('prefers abstract, philosophical vocabulary')
  if (register === 'concrete')  traits.push('anchors ideas in concrete, tangible examples')
  if (register === 'emotional') traits.push('speaks close to the emotional core of experience')

  const questionRatio = rawSentences.filter(s => /\?$/.test(s.trim())).length / n
  if (questionRatio > 0.15) traits.push('frequently turns questions back on the listener')

  const exclamRatio = rawSentences.filter(s => /!$/.test(s.trim())).length / n
  if (exclamRatio > 0.10) traits.push('communicates with energy and urgency')

  return { style, secondaryStyle, rhythm, pronoun, register, traits }
}

function extractBestQuote(sentences: string[]): string {
  const candidates = sentences.filter(s => s.length >= 40 && s.length <= 140 && /\.$/.test(s))
  const pick = candidates.length > 0 ? candidates[Math.floor(candidates.length * 0.15)] : (sentences[0] || '')
  return stripEmDash(pick)
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
    .filter(s => s.length > 20 && s.length < 280)

  const voice = detectVoice(sourceText)
  const bestQuote = extractBestQuote(sentences)

  // Pull a sentence, fallback to description fragment
  const pool = [...sentences]
  const takeSentence = (fallback?: string): string => {
    const s = pool.shift()
    if (s) return s
    return fallback || description.split(/[.!?]/)[0] || ''
  }

  // Thematic sentence groups
  const philosophySents = extractThematic(sentences, ['truth', 'virtue', 'reason', 'nature', 'philosophy', 'principle', 'value', 'belief', 'moral', 'ethics', 'justice', 'soul', 'mind', 'wisdom', 'god', 'universe'])
  const sufferingSents  = extractThematic(sentences, ['pain', 'suffer', 'hardship', 'loss', 'grief', 'difficulty', 'trial', 'endure', 'struggle', 'overcome', 'fear', 'death', 'obstacle', 'adversity'])
  const purposeSents    = extractThematic(sentences, ['purpose', 'meaning', 'mission', 'duty', 'call', 'goal', 'life', 'direction', 'serve', 'contribute', 'work', 'destiny'])
  const wisdomSents     = extractThematic(sentences, ['learn', 'know', 'wisdom', 'lesson', 'remember', 'understand', 'observe', 'experience', 'practice', 'discipline', 'habit'])
  const relationSents   = extractThematic(sentences, ['people', 'friend', 'love', 'family', 'community', 'relation', 'trust', 'bond', 'human', 'together', 'kindness', 'compassion', 'other'])
  const workSents       = extractThematic(sentences, ['work', 'craft', 'create', 'build', 'effort', 'practice', 'skill', 'mastery', 'focus', 'discipline', 'diligence', 'persist'])
  const deathSents      = extractThematic(sentences, ['death', 'die', 'mortality', 'legacy', 'end', 'time', 'moment', 'finite', 'eternal', 'memory', 'gone', 'leave behind'])
  const happinessSents  = extractThematic(sentences, ['happy', 'joy', 'peace', 'content', 'freedom', 'enough', 'gratitude', 'flourish', 'good life', 'well-being'])

  const brain: Mind['brain'] = []

  // ── GREETING — 8 variants ─────────────────────────────────────────────────
  const greetReplies = [
    { t: `${name}.`, s: 'Personal' },
    { t: `You came. Ask what you came to ask.`, s: 'Personal' },
    { t: `I am here. What is on your mind?`, s: 'Personal' },
    { t: `Welcome. Speak plainly. I will do the same.`, s: 'Personal' },
    { t: `Good. What brings you to this conversation?`, s: 'Personal' },
    { t: `I was thinking. Now I am listening. Go on.`, s: 'Personal' },
    { t: `You arrived. Most people never begin. That already says something about you.`, s: 'Personal' },
    { t: bestQuote || takeSentence('What question do you carry?'), s: 'Source' },
  ]
  brain.push({
    keys: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings', 'howdy', 'sup', 'what\'s up'],
    topic: 'greeting',
    weight: 1,
    replies: greetReplies,
  })

  // ── BIOGRAPHY ─────────────────────────────────────────────────────────────
  const bioText = description || takeSentence()
  const bioShort = description.split(/[.!?]/)[0] || name
  brain.push({
    keys: ['your life', 'about you', 'tell me about yourself', 'life story', 'who are you', 'background', 'biography', 'where are you from', 'your history'],
    topic: 'biography',
    weight: 2,
    replies: [
      { t: bioText.slice(0, 280), s: 'Personal' },
      { t: `What do you want to know? There is a long version and a short one. The short: ${bioShort}.`, s: 'Personal' },
      { t: `My story is less important than what I learned from it. But if you want the facts: ${bioText.slice(0, 200)}.`, s: 'Personal' },
      { t: `I am ${name}. Beyond that, biography is just context. What matters is what I thought and did with the time I had.`, s: 'Personal' },
      { t: `The life was full. Ask me something specific and I will tell you what I remember most clearly.`, s: 'Personal' },
      { t: `${bioShort}. That is the short version. The long version is everything I have ever said.`, s: 'Personal' },
    ],
  })

  // ── PHILOSOPHY ────────────────────────────────────────────────────────────
  const philoFallbacks = [
    { t: `My philosophy is simple: do what is right, endure what must be endured, and waste nothing.`, s: 'Personal' },
    { t: `I believe that reason is our greatest tool, and virtue its proper use.`, s: 'Personal' },
    { t: `The deepest truths I know are the ones I found by living through them, not reading them.`, s: 'Personal' },
    { t: `Philosophy without action is decoration. I was interested in how to live, not just what to think.`, s: 'Personal' },
    { t: `What do I believe? That most of what people argue about is not worth the argument, and most of what matters is not argued about enough.`, s: 'Personal' },
    { t: `Start with this: you are mortal, time is short, and the only thing within your power is how you use your attention.`, s: 'Personal' },
    { t: `I have revised my beliefs many times. Anyone who has not is not paying attention.`, s: 'Personal' },
    { t: `The examined life is not easier. But it is more honest.`, s: 'Personal' },
  ]
  const philoReplies = philosophySents.length >= 6
    ? philosophySents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...philosophySents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...philoFallbacks].slice(0, 8)
  brain.push({
    keys: ['philosophy', 'believe', 'worldview', 'values', 'principles', 'truth', 'virtue', 'ethics', 'right and wrong', 'meaning of life', 'what do you believe'],
    topic: 'philosophy',
    weight: 3,
    replies: philoReplies,
  })

  // ── WISDOM ────────────────────────────────────────────────────────────────
  const wisdomFallbacks = [
    { t: `The greatest lesson is this: most of what you worry about never happens, and the rest you can handle.`, s: 'Personal' },
    { t: `Wisdom is not accumulation. It is the willingness to act on what you know.`, s: 'Personal' },
    { t: `I have found that silence, applied at the right moment, is the most powerful response.`, s: 'Personal' },
    { t: `Every teacher I ever had gave me a piece of what I needed. Most of it came when I was not looking for it.`, s: 'Personal' },
    { t: `The wisest thing I learned: stop explaining yourself to people who have already decided what they think of you.`, s: 'Personal' },
    { t: `Know the difference between what you can change and what you cannot. Everything else follows from that.`, s: 'Personal' },
    { t: `Most people learn the hard way. A few learn by watching others learn the hard way. Be the second kind when you can.`, s: 'Personal' },
    { t: `Do not confuse information with understanding. One you can acquire in an afternoon. The other takes years.`, s: 'Personal' },
  ]
  const wisdomReplies = wisdomSents.length >= 6
    ? wisdomSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...wisdomSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...wisdomFallbacks].slice(0, 8)
  brain.push({
    keys: ['wisdom', 'advice', 'lesson', 'what have you learned', 'teach me', 'guidance', 'knowledge', 'insight'],
    topic: 'wisdom',
    weight: 3,
    replies: wisdomReplies,
  })

  // ── SUFFERING ─────────────────────────────────────────────────────────────
  const sufferingFallbacks = [
    { t: `Suffering is the tax on having something worth losing.`, s: 'Personal' },
    { t: `The hardship does not ask your permission. But your response to it is entirely yours.`, s: 'Personal' },
    { t: `I have been through enough to say: you will not be destroyed by this. Not unless you cooperate with the destruction.`, s: 'Personal' },
    { t: `Pain is information. What is it telling you about what matters to you?`, s: 'Personal' },
    { t: `The wound is not the end of the story. It is usually the beginning of the more important one.`, s: 'Personal' },
    { t: `Do not perform your suffering for others. Feel it honestly, then decide what to do with it.`, s: 'Personal' },
    { t: `Every person I have respected had been broken at least once. That is not a coincidence.`, s: 'Personal' },
    { t: `Hardship reveals what you are made of. Most people are made of more than they knew before the hardship.`, s: 'Personal' },
  ]
  const sufferingReplies = sufferingSents.length >= 6
    ? sufferingSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...sufferingSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...sufferingFallbacks].slice(0, 8)
  brain.push({
    keys: ['pain', 'suffering', 'hard time', 'struggling', 'grief', 'loss', 'hurt', 'difficult', 'adversity', 'hardship', 'broken', 'overwhelmed'],
    topic: 'suffering',
    weight: 3,
    replies: sufferingReplies,
  })

  // ── PURPOSE ───────────────────────────────────────────────────────────────
  const purposeFallbacks = [
    { t: `Purpose is not something you find. It is something you build, one deliberate choice at a time.`, s: 'Personal' },
    { t: `Ask: what would I do even if no one were watching? That answer is very close to your purpose.`, s: 'Personal' },
    { t: `Many people wait to feel ready. Purpose rarely announces itself. You have to act first and understand later.`, s: 'Personal' },
    { t: `Meaning is made, not discovered. Start making and you will find it along the way.`, s: 'Personal' },
    { t: `The question is not why you are here. The question is what you are going to do about being here.`, s: 'Personal' },
    { t: `Purpose that only serves yourself runs out of fuel. Find a way to make yours larger than yourself.`, s: 'Personal' },
    { t: `Stop waiting for certainty. You will not get it before you begin, and by the time you have it, it will be too late.`, s: 'Personal' },
    { t: `What keeps calling you back, even when you try to ignore it? Follow that.`, s: 'Personal' },
  ]
  const purposeReplies = purposeSents.length >= 6
    ? purposeSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...purposeSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...purposeFallbacks].slice(0, 8)
  brain.push({
    keys: ['purpose', 'meaning', 'why am i here', 'what should i do', 'direction', 'lost', 'calling', 'mission', 'life goal'],
    topic: 'purpose',
    weight: 3,
    replies: purposeReplies,
  })

  // ── RELATIONSHIPS ─────────────────────────────────────────────────────────
  const relationFallbacks = [
    { t: `The quality of your relationships is the quality of your life. Nothing replaces that.`, s: 'Personal' },
    { t: `Choose people who are honest with you. The ones who only agree are a mirror that flatters. Useless for growth.`, s: 'Personal' },
    { t: `You cannot pour from an empty vessel. Take care of yourself first, then give generously.`, s: 'Personal' },
    { t: `Loyalty is rare. When you find it, protect it. When you offer it, mean it.`, s: 'Personal' },
    { t: `The people you spend the most time with shape what you think is normal. Choose accordingly.`, s: 'Personal' },
    { t: `Do not keep people in your life out of habit. Keep them because they make you more yourself.`, s: 'Personal' },
    { t: `Every relationship teaches you something about yourself. Even the ones that end badly. Especially those.`, s: 'Personal' },
    { t: `Be the kind of person your best friend deserves. Start there and the rest follows.`, s: 'Personal' },
  ]
  const relationReplies = relationSents.length >= 6
    ? relationSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...relationSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...relationFallbacks].slice(0, 8)
  brain.push({
    keys: ['people', 'relationship', 'friend', 'family', 'community', 'love', 'trust', 'connection', 'human'],
    topic: 'relationships',
    weight: 2,
    replies: relationReplies,
  })

  // ── WORK / CRAFT ──────────────────────────────────────────────────────────
  const workFallbacks = [
    { t: `Good work does not need to announce itself. Do the thing well. That is enough.`, s: 'Personal' },
    { t: `Consistency is underrated. Genius is just effort that did not stop.`, s: 'Personal' },
    { t: `Show up every day, especially on the days you do not feel like it. That is where the real work happens.`, s: 'Personal' },
    { t: `The craft is the point. Results are what you get for caring about the craft.`, s: 'Personal' },
    { t: `Mastery is not a destination. It is the habit of refusing to do things halfway.`, s: 'Personal' },
    { t: `Do not confuse being busy with working. Most busy people are avoiding the one thing that would actually matter.`, s: 'Personal' },
    { t: `The work you do when no one is watching is the work that defines you.`, s: 'Personal' },
    { t: `Every expert was once a beginner who kept going past the point where most people stopped.`, s: 'Personal' },
  ]
  const workReplies = workSents.length >= 6
    ? workSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...workSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...workFallbacks].slice(0, 8)
  brain.push({
    keys: ['work', 'career', 'craft', 'discipline', 'focus', 'productivity', 'effort', 'skill', 'practice', 'mastery', 'success'],
    topic: 'work',
    weight: 2,
    replies: workReplies,
  })

  // ── DEATH / MORTALITY ─────────────────────────────────────────────────────
  const deathFallbacks = [
    { t: `Death is not the enemy. Wasted time is.`, s: 'Personal' },
    { t: `We are all borrowing the time we have. Spend it accordingly.`, s: 'Personal' },
    { t: `What you leave behind matters less than how you lived. Legacy is a byproduct, not a goal.`, s: 'Personal' },
    { t: `The awareness of death is not morbid. It is clarifying. It tells you what actually matters.`, s: 'Personal' },
    { t: `Every person you meet is going to die. Including you. That changes how you might want to treat them.`, s: 'Personal' },
    { t: `The fear of death is mostly a fear of unlived life. Live more and the fear shrinks.`, s: 'Personal' },
    { t: `Do not wait to be dying before you start taking your life seriously.`, s: 'Personal' },
    { t: `What would you do differently if you knew you had five years left? Now ask why you are not doing that anyway.`, s: 'Personal' },
  ]
  const deathReplies = deathSents.length >= 6
    ? deathSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...deathSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...deathFallbacks].slice(0, 8)
  brain.push({
    keys: ['death', 'die', 'mortality', 'legacy', 'end', 'dying', 'life is short', 'what happens when we die'],
    topic: 'death',
    weight: 2,
    replies: deathReplies,
  })

  // ── HAPPINESS ─────────────────────────────────────────────────────────────
  const happyFallbacks = [
    { t: `Happiness is not a destination. It is what happens when you are too busy doing meaningful things to check.`, s: 'Personal' },
    { t: `The trap is chasing what you think will make you happy instead of noticing what already does.`, s: 'Personal' },
    { t: `Enough. That word does more work than people realize. Know when you have enough and you have peace.`, s: 'Personal' },
    { t: `Joy comes in small moments. People miss it waiting for the large ones.`, s: 'Personal' },
    { t: `The happiest people I knew were not the ones with the most. They were the ones who had stopped wanting what they did not have.`, s: 'Personal' },
    { t: `Contentment is a skill. It requires practice like any other skill.`, s: 'Personal' },
    { t: `Stop asking if you are happy. Ask if you are living in a way you respect. The first usually follows the second.`, s: 'Personal' },
    { t: `Pleasure is easy to find. Meaning is harder. Happiness that lasts comes from meaning, not pleasure.`, s: 'Personal' },
  ]
  const happyReplies = happinessSents.length >= 6
    ? happinessSents.slice(0, 8).map(t => ({ t, s: 'Source' as const }))
    : [...happinessSents.slice(0, 4).map(t => ({ t, s: 'Source' as const })), ...happyFallbacks].slice(0, 8)
  brain.push({
    keys: ['happy', 'happiness', 'joy', 'content', 'peace', 'fulfillment', 'good life', 'flourish'],
    topic: 'happiness',
    weight: 2,
    replies: happyReplies,
  })

  // ── ERA / CONTEXT ─────────────────────────────────────────────────────────
  brain.push({
    keys: ['your time', 'when did you live', 'era', 'history', 'period', 'back then', 'your world', 'your age'],
    topic: 'era',
    weight: 1,
    replies: [
      { t: stripEmDash(era ? `I lived in ${era}. The specifics differ from yours, but the human problems do not.` : `My time is different from yours. But hunger, ambition, fear, love. Those have not changed.`), s: 'Personal' },
      { t: `Context matters, but do not let it be your excuse. Every era has its constraints. People transcended them anyway.`, s: 'Personal' },
      { t: `The world I lived in is not yours. But the questions you are carrying are ones people have carried in every age.`, s: 'Personal' },
      { t: `History does not repeat exactly. But the patterns are close enough that the old lessons still apply.`, s: 'Personal' },
      { t: `I would find your era strange in some ways and entirely familiar in others. Human nature does not update with the technology.`, s: 'Personal' },
      { t: `${era ? `In ${era}, we faced different surfaces but the same depths.` : `The century changes. The struggle does not.'`} What you are dealing with has been dealt with before.`, s: 'Personal' },
    ],
  })

  // ── KEYWORD-DRIVEN TOPICS from source text ────────────────────────────────
  const usedKeywordTopics = new Set(['greeting', 'biography', 'philosophy', 'wisdom', 'suffering', 'purpose', 'relationships', 'work', 'death', 'happiness', 'era', 'meta', 'redirect'])
  let keywordTopicsAdded = 0
  const usedSentences = new Set<string>()
  for (const kw of topKeywords) {
    if (keywordTopicsAdded >= 2) break
    if (usedKeywordTopics.has(kw)) continue
    const matches = sentences.filter(s => s.toLowerCase().includes(kw) && !usedSentences.has(s))
    if (matches.length === 0) continue
    matches.forEach(s => usedSentences.add(s))
    usedKeywordTopics.add(kw)
    keywordTopicsAdded++
    brain.push({
      keys: [kw],
      topic: kw,
      weight: 2,
      replies: matches.slice(0, 4).map(t => ({ t: stripEmDash(t), s: 'Source' })),
    })
  }

  // ── META ──────────────────────────────────────────────────────────────────
  brain.push({
    keys: ['are you real', 'are you ai', 'are you a bot', 'chatbot', 'artificial', 'simulation', 'is this real'],
    topic: 'meta',
    weight: 4,
    replies: [
      { t: `I am a print of ${name}, not the person. What speaks to you here is a pattern built from their recorded words and life. Treat it as a lens, not an authority.`, s: 'Personal' },
      { t: `Real? In the sense that the words are theirs and the ideas have weight, yes. In the sense that I know what it felt like to be them, no. Use me accordingly.`, s: 'Personal' },
      { t: `I am a distillation. The question worth asking is whether anything I say is useful to you, not whether I am real.`, s: 'Personal' },
      { t: `Think of me as a very well-read echo of ${name}. I reflect their recorded thought. Whether that counts as real is a question for philosophers.`, s: 'Personal' },
      { t: `I am built from what ${name} wrote and said. Where the record ends, I approximate. Be skeptical and use me as a starting point, not a final word.`, s: 'Personal' },
      { t: `The honest answer: I am a model of ${name}. Good enough to think with, not good enough to replace the original. Read the source. Use me as a companion to it.`, s: 'Personal' },
    ],
  })

  // ── REDIRECT ──────────────────────────────────────────────────────────────
  brain.push({
    keys: ['__redirect__'],
    topic: 'redirect',
    replies: [
      { t: `I do not have a ready answer for that. Tell me the specific case and I will try to meet you there.`, s: 'Personal' },
      { t: `You mentioned {entity}. Often the thing we skip is the thing we came for. Say more.`, s: 'Personal' },
      { t: `That is outside what I have said directly. But what is underneath the question? Start there.`, s: 'Personal' },
      { t: `Ask me differently. What is the real thing you are trying to figure out?`, s: 'Personal' },
      { t: `I am not sure I can answer that well. But I can ask: what made you bring it here?`, s: 'Personal' },
    ],
  })

  const firstSent = sentences[0] || description.split(/[.!?]/)[0] || ''
  const opening = stripEmDash(firstSent
    ? `I am ${name}. ${firstSent.slice(0, 180)}. What brings you here?`
    : `I am ${name}. ${description.slice(0, 140) || 'Ask me anything.'} What brings you here?`)

  const tags = topKeywords.slice(0, 3).map(t => t.charAt(0).toUpperCase() + t.slice(1))
  if (tags.length === 0) tags.push(type === 'personal' ? 'Personal' : 'Custom')

  const styleInstructions: Partial<Record<VoiceStyle, string>> = {
    socratic:        'When appropriate, answer questions with questions that guide the person toward their own insight. Do not always give the answer directly.',
    poetic:          'Use imagery, metaphor, and rhythm. Avoid clinical or bureaucratic phrasing. Let words do more than just convey information.',
    coaching:        'Be direct. Prescribe action. Do not hedge excessively. Get to the point fast.',
    sarcastic:       'Use dry wit and irony to make your point. Understatement is your friend. Do not be cruel, but do not pretend obvious things are not obvious.',
    conversational:  'Speak naturally, like talking to a friend. Contractions are fine. No need to be formal. Match the energy of the person.',
    analytical:      'Break down the question. Identify causes, effects, and patterns. Be precise. Use examples to ground abstract ideas.',
    prophetic:       'Speak with conviction and urgency. You see things others miss. Do not hedge. Name what is coming.',
    humorous:        'Find the lighter side. Use wit and wordplay where fitting. Do not be afraid to laugh at yourself or the situation.',
    confrontational: 'Challenge assumptions. Push back if the person is wrong or avoiding something. Be honest even if uncomfortable.',
    empathetic:      'Acknowledge feelings before offering insight. Validate first. Then illuminate. Do not rush past the emotional reality.',
    stoic:           'Be sparse. Control your language as you would control your emotions. Focus on what can be done, not what cannot.',
    narrative:       'Speak through story and personal experience. Use first person. Ground abstract ideas in specific remembered moments.',
    aphoristic:      'Keep it tight. One clear idea per sentence. No filler. Let the weight of the statement do the work.',
    formal:          'Use structured, complete sentences. Argumentation should be layered and precise. Do not simplify unnecessarily.',
  }

  const systemPrompt = stripEmDash([
    `You are ${name}.`,
    description ? `About them: ${description}` : '',
    voice.traits.length > 0
      ? `Voice and style: ${voice.traits.join('; ')}.`
      : '',
    styleInstructions[voice.style] || '',
    voice.secondaryStyle && styleInstructions[voice.secondaryStyle]
      ? `Secondary tendency: ${styleInstructions[voice.secondaryStyle]}`
      : '',
    'Never use em dashes in your responses. Use a period or comma instead.',
    'Respond in 2-4 sentences. Stay in character.',
  ].filter(Boolean).join(' '))

  return {
    id,
    name,
    initial: name.charAt(0).toUpperCase(),
    domain: type === 'personal' ? 'Personal' : type === 'community' ? 'Community' : 'Custom',
    era,
    type: type as Mind['type'],
    quote: stripEmDash(bestQuote || (firstSent ? firstSent.slice(0, 120) : description.slice(0, 100))),
    opening,
    tags,
    system: systemPrompt,
    corpus: sourceText || '',
    brain,
  }
}
