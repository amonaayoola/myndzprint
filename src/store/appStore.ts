'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mind, Message, AppState, BuildState } from '../types'
import { PUBLIC_MINDS } from '../data/minds'
import { CORPUS } from '../data/corpus'

const MINDS_WITH_CORPUS: Mind[] = PUBLIC_MINDS.map(m => ({
  ...m,
  corpus: CORPUS[m.id] || m.corpus || '',
}))

export type Provider = 'anthropic' | 'openai' | 'openrouter'

interface Store extends AppState {
  minds: Mind[]

  // Navigation
  setPage: (page: AppState['page']) => void
  setAppView: (view: AppState['appView']) => void
  setAuthMode: (mode: AppState['authMode']) => void

  // Auth
  login: (name: string, email: string) => void
  logout: () => void

  // Minds
  selectMind: (id: string) => void
  addMind: (mind: Mind) => void
  updateMindCorpus: (mindId: string, corpus: string) => void
  currentMind: () => Mind | undefined

  // Chat
  addMessage: (mindId: string, msg: Message) => void
  getMessages: (mindId: string) => Message[]

  // Library
  setActiveTag: (tag: string) => void

  // Settings — multi-provider
  apiKey: string
  provider: Provider
  model: string
  setApiKey: (key: string) => void
  setProvider: (p: Provider) => void
  setModel: (m: string) => void

  // Build
  buildState: BuildState
  setBuildState: (updates: Partial<BuildState>) => void
  resetBuild: () => void

  // Modals
  earlyAccessOpen: boolean
  setEarlyAccessOpen: (open: boolean) => void
  buildModalOpen: boolean
  setBuildModalOpen: (open: boolean) => void
}

const defaultBuildState: BuildState = {
  step: 0,
  type: 'personal',
  result: null,
  loading: false,
  error: null,
}

const initialConversations: Record<string, Message[]> = {}
for (const m of MINDS_WITH_CORPUS) initialConversations[m.id] = []

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      // State
      page: 'landing',
      authMode: 'login',
      appView: 'home',
      user: null,
      currentMindId: null,
      conversations: initialConversations,
      activeTag: 'All',
      apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_KEY || '',
      provider: 'anthropic' as Provider,
      model: 'claude-haiku-4-5-20251001',
      minds: MINDS_WITH_CORPUS,
      buildState: defaultBuildState,
      earlyAccessOpen: false,
      buildModalOpen: false,

      // Navigation
      setPage: (page) => set({ page }),
      setAppView: (appView) => set({ appView }),
      setAuthMode: (authMode) => set({ authMode }),

      // Auth
      login: (name, email) => {
        set({ user: { name, email }, page: 'app', appView: 'home' })
        const { minds, conversations } = get()
        if (!get().currentMindId) set({ currentMindId: minds[0]?.id ?? null })
        const updated = { ...conversations }
        for (const m of minds) {
          if (!updated[m.id]) updated[m.id] = []
        }
        set({ conversations: updated })

        // Load community minds published by other users
        fetch('/api/community-minds')
          .then(r => r.json())
          .then(({ minds: communityMinds }) => {
            if (!Array.isArray(communityMinds) || communityMinds.length === 0) return
            const { minds: currentMinds, conversations: currentConvs } = get()
            const currentIds = new Set(currentMinds.map((m: Mind) => m.id))
            const newMinds = communityMinds
              .filter((m: Mind) => !currentIds.has(m.id))
              .map((m: Mind) => ({ ...m, type: 'community' as const }))
            if (newMinds.length === 0) return
            const newConvs = { ...currentConvs }
            for (const m of newMinds) { if (!newConvs[m.id]) newConvs[m.id] = [] }
            set({ minds: [...currentMinds, ...newMinds], conversations: newConvs })
          })
          .catch(() => { /* non-fatal */ })
      },
      logout: () => {
        // Sign out from Supabase Auth (non-blocking)
        import('../lib/supabaseClient').then(({ authSignOut }) => {
          authSignOut().catch(console.warn)
        })
        const convReset: Record<string, Message[]> = {}
        for (const m of MINDS_WITH_CORPUS) convReset[m.id] = []
        set({
          user: null,
          page: 'landing',
          appView: 'home',
          currentMindId: null,
          conversations: convReset,
          minds: MINDS_WITH_CORPUS,
          apiKey: '',
        })
      },

      // Minds
      selectMind: (id) => set({ currentMindId: id, appView: 'chat' }),
      updateMindCorpus: (mindId, corpus) => {
        const { minds } = get()
        const updated = minds.map(m => m.id === mindId ? { ...m, corpus } : m)
        set({ minds: updated })
        const mind = updated.find(m => m.id === mindId)
        if (mind) {
          import('../lib/indexer').then(({ reIndexMind }) => {
            reIndexMind(mind, {}).catch(console.warn)
          })
        }
      },
      addMind: (mind) => {
        const { minds, conversations } = get()
        if (minds.find(m => m.id === mind.id)) return
        set({
          minds: [...minds, mind],
          conversations: { ...conversations, [mind.id]: [] },
          currentMindId: mind.id,
          appView: 'chat',
        })
        if (mind.corpus || mind.brain?.length) {
          import('../lib/vectorStore').then(({ hasChunks }) => {
            hasChunks(mind.id).then(already => {
              if (!already) {
                import('../lib/indexer').then(({ indexMind }) => {
                  indexMind(mind, {}).catch(console.warn)
                })
              }
            }).catch(console.warn)
          })
        }
      },
      currentMind: () => {
        const { minds, currentMindId } = get()
        return minds.find(m => m.id === currentMindId)
      },

      // Chat
      addMessage: (mindId, msg) => {
        const { conversations } = get()
        const existing = conversations[mindId] || []
        set({ conversations: { ...conversations, [mindId]: [...existing, msg] } })
      },
      getMessages: (mindId) => get().conversations[mindId] || [],

      // Library
      setActiveTag: (tag) => set({ activeTag: tag }),

      // Settings
      setApiKey: (key) => set({ apiKey: key }),
      setProvider: (provider) => set({ provider, apiKey: '', model: defaultModelForProvider(provider) }),
      setModel: (model) => set({ model }),

      // Build
      setBuildState: (updates) => set(s => ({ buildState: { ...s.buildState, ...updates } })),
      resetBuild: () => set({ buildState: defaultBuildState }),

      // Modals
      setEarlyAccessOpen: (open) => set({ earlyAccessOpen: open }),
      setBuildModalOpen: (open) => set({ buildModalOpen: open }),
    }),
    {
      name: 'myndzprint-store',
      partialize: (s) => ({
        user: s.user,
        apiKey: s.apiKey,
        provider: s.provider,
        model: s.model,
        conversations: s.conversations,
        currentMindId: s.currentMindId,
        minds: s.minds.map(m => ({ ...m, corpus: '' })),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.user) {
          state.page = 'app'
          if (!state.appView) state.appView = 'home'
        }
        const publicIds = new Set(MINDS_WITH_CORPUS.map(m => m.id))
        const userMinds = (state.minds || [])
          .filter((m: Mind) => !publicIds.has(m.id))
          .map((m: Mind) => ({ ...m, corpus: CORPUS[m.id] || m.corpus || '' }))
        state.minds = [...MINDS_WITH_CORPUS, ...userMinds]
        const convs = state.conversations || {}
        for (const m of state.minds) {
          if (!convs[m.id]) convs[m.id] = []
        }
        state.conversations = convs
        // Defaults for fields added after initial release
        if (!state.provider) state.provider = 'anthropic'
        if (!state.model) state.model = 'claude-haiku-4-5-20251001'
      },
    }
  )
)

export function defaultModelForProvider(provider: Provider): string {
  if (provider === 'anthropic') return 'claude-haiku-4-5-20251001'
  if (provider === 'openai') return 'gpt-4o-mini'
  return 'openai/gpt-4o-mini' // openrouter default
}

export const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (smart)' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (best)' },
]

export const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { id: 'gpt-4o', label: 'GPT-4o (smart)' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (cheapest)' },
]
