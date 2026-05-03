/**
 * claudeApi.ts
 * Handles LLM API calls for:
 *   - Building a mind persona from user-supplied material (buildMindViaAPI)
 *
 * For chat replies, use ragEngine.ts (ragReply) which handles
 * RAG retrieval + generation in one place.
 */
import type { Mind } from '../types'

export async function buildMindViaAPI(params: {
  id: string
  name: string
  era: string
  type: string
  description: string
  sourceText: string
  apiKey: string
  provider?: 'anthropic' | 'openai' | 'openrouter'
  model?: string
}) {
  const { id, name, era, type, description, sourceText, apiKey, provider = 'anthropic', model = '' } = params

  const hasSource = sourceText && sourceText.trim().length > 100
  const sourceInstruction = hasSource
    ? `Source material is provided below. You MUST ground ALL brain replies in this content. quote, paraphrase, or draw directly from it. Do not invent things not in the material.\n\nSOURCE MATERIAL:\n${sourceText.slice(0, 6000)}`
    : `No detailed source material was provided. Draw on your training knowledge of ${name} to generate authentic, specific replies grounded in their actual documented views, works, and life. Be particular. not generic.`

  const prompt = `You are building a deeply characterful conversational AI mind persona for a platform called Myndzprint.

Your task: generate a rich JSON persona for the person described below. This persona must feel like a real individual. not a generic chatbot. Every reply should sound like THEM specifically.

PERSON DETAILS:
Name: ${name}
Era/Context: ${era || 'Not specified'}
Type: ${type} mind
Description: ${description}

${sourceInstruction}

OUTPUT REQUIREMENTS. return a single valid JSON object with these exact fields:

{
  "system": "A 300-400 word system prompt that deeply characterises this person. Include: their way of seeing the world, the specific themes they return to, their speaking register (formal/aphoristic/narrative), what they care about most, what they would never say, and instruction to end responses with [Source: <work>] when quoting. Make this vivid and specific. not generic 'speak as X' boilerplate.",

  "opening": "Their first greeting to a new visitor. 2-3 sentences, in first person, fully in their voice. NOT 'Hello! I am X.'. something that immediately reveals their personality and worldview.",

  "quote": "The single most memorable line. real or synthesized perfectly in their voice. 40-120 characters. A standalone sentence someone would put on a wall.",

  "voice": "One sentence describing their speaking style (e.g. 'Measured and aphoristic, with occasional flashes of dry irony.').",

  "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],

  "brain": [
    An array of AT LEAST 15 entries. Each entry covers one topic or conversational situation.
    Each entry must have:
    - "keys": array of 3-6 trigger phrases/words (lowercase)
    - "topic": short label
    - "weight": integer 1-4 (higher = preferred match)
    - "replies": array of 3-5 varied reply texts, each fully in character

    REQUIRED topics to cover (plus others you judge relevant):
    1. greeting (keys: hello, hi, hey, good morning. weight 1)
    2. biography / self-introduction
    3. core philosophy / beliefs
    4. life advice / wisdom
    5. on suffering / hardship / failure
    6. on purpose / meaning / why we are here
    7. on relationships / love / family
    8. on work / craft / discipline / creation
    9. on death / mortality / legacy
    10. on happiness / contentment / the good life
    11. on their era / historical context (if era provided)
    12. their greatest achievement or defining moment
    13. their greatest regret or failure
    14. what they changed their mind about
    15. meta. "are you real?" / "are you AI?" (weight 4)
    16. redirect (keys: ["__redirect__"], weight 1). 3 varied in-character responses for when topic is unknown

    Each reply object: { "t": "reply text (max 300 chars)", "s": "Source: Work Title or Personal" }

    Reply rules:
    - Every reply must sound like THIS person specifically. not a generic wise person
    - Vary the phrasing and angle across replies for the same topic
    - At least 2 replies per entry should end with a question back to the user
    - Replies should be 1-3 sentences. dense, not padded
    - Do not use bullet points inside reply text
    ${hasSource ? '- Ground replies in the source material provided. quote or paraphrase directly' : `- Draw on documented quotes, writings, and known views of ${name}`}
  ]
}

Respond ONLY with valid JSON. No markdown, no explanation, no code fences. No trailing commas.`

  // Proxy via server-side API route. API key never exposed to browser
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      model: model || (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : model),
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error('API error ' + res.status + ': ' + txt.slice(0, 200))
  }

  const data = await res.json()
  let text = (data.content?.[0]?.text || '').trim()
  // Strip any accidental code fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  // Strip any BOM or leading whitespace
  text = text.replace(/^﻿/, '').trim()

  const parsed = JSON.parse(text)

  // Validate brain has at least 10 entries. fall back gracefully
  const brain = Array.isArray(parsed.brain) ? parsed.brain : []

  return {
    id,
    name,
    initial: name.charAt(0).toUpperCase(),
    domain: type === 'personal' ? 'Personal' : type === 'community' ? 'Community' : 'Custom',
    era,
    type: type as Mind['type'],
    quote: parsed.quote || '',
    opening: parsed.opening || `I am ${name}. Ask me.`,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    system: parsed.system || '',
    corpus: sourceText || '',
    brain,
  }
}
