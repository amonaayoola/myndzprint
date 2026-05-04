/**
 * analytics.ts — lightweight event tracking
 * Fire-and-forget: never throws, never blocks the UI.
 */

export type TrackEvent =
  | 'page_visit'
  | 'signup'
  | 'login'
  | 'mind_open'
  | 'message_sent'
  | 'mind_created'
  | 'settings_open'
  | 'api_key_saved'

export function track(
  event: TrackEvent,
  opts: { mindId?: string; userEmail?: string; metadata?: Record<string, unknown> } = {}
) {
  if (typeof window === 'undefined') return
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, mindId: opts.mindId, userEmail: opts.userEmail, metadata: opts.metadata }),
  }).catch(() => {}) // silent — never block
}
