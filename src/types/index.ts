export interface BrainReply {
  t: string
  s: string
}

export interface BrainEntry {
  keys: string[]
  topic: string
  weight?: number
  replies: BrainReply[]
}

export interface Mind {
  id: string
  name: string
  initial: string
  domain: string
  era: string
  type: 'public' | 'personal' | 'community'
  quote: string
  opening: string
  tags: string[]
  system?: string
  brain: BrainEntry[]
  corpus?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: string
  engine?: string
  timestamp: number
}

export interface AppState {
  page: 'landing' | 'auth' | 'app'
  authMode: 'login' | 'signup'
  appView: 'home' | 'chat' | 'dash' | 'settings'
  user: { name: string; email: string } | null
  currentMindId: string | null
  conversations: Record<string, Message[]>
  activeTag: string
  apiKey: string
}

export interface BuildState {
  step: number
  type: 'personal' | 'community' | 'public'
  result: Mind | null
  loading: boolean
  error: string | null
}

export interface WaitlistEntry {
  name: string
  email: string
  ts: number
}
