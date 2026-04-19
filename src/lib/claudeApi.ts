/**
 * claudeApi.ts
 * Handles Claude API calls for:
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
}) {
  const { id, name, era, type, description, sourceText, apiKey } = params

  const prompt = `You are building a conversational AI mind persona for a platform called Myndzprint.
Given the following information about a person, produce a JSON object with exactly these fields:
- system: A system prompt (200-350 words) that instructs an AI to speak as this person. Include their speaking style, core themes, and instruction to end responses with [Source: <work>] when quoting.
- opening: Their first greeting message to a user (1-2 sentences, in first person, in their voice).
- quote: One memorable quote from them (or plausibly in their style if personal mind).
- tags: Array of 2-4 short topic tags (e.g. ["Philosophy", "Leadership"]).
- brain: Array of 6-10 objects, each { "keys": ["keyword", "phrase"], "topic": "topic_label", "replies": [{ "t": "reply text in their voice ending with a question", "s": "Source" }] }. Cover: greeting, their core topics, meta ("are you real"), and a redirect entry with keys:["__redirect__"] and 2 reply variants.

Person details:
Name: ${name}
Era/Context: ${era}
Type: ${type} mind
Description: ${description}
${sourceText ? 'Source material:\n' + sourceText.slice(0, 3000) : ''}

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error('API error ' + res.status + ': ' + txt.slice(0, 200))
  }

  const data = await res.json()
  let text = (data.content?.[0]?.text || '').trim()
  text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(text)

  return {
    id,
    name,
    initial: name.charAt(0).toUpperCase(),
    domain: type === 'personal' ? 'Personal' : type === 'community' ? 'Community' : 'Custom',
    era,
    type: type as Mind['type'],
    quote: parsed.quote || '',
    opening: parsed.opening || `I am ${name}. Ask me.`,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
    system: parsed.system || '',
    corpus: sourceText || '',
    brain: Array.isArray(parsed.brain) ? parsed.brain : [],
  }
}
