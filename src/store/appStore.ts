'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mind, Message, AppState, BuildState } from '../types'
import { PUBLIC_MINDS } from '../data/minds'
import { CORPUS } from '../data/corpus'

// Attach corpus to public minds
const MINDS_WITH_CORPUS: Mind[] = PUBLIC_MINDS.map(m => ({
  ...m,
  corpus: CORPUS[m.id] || m.corpus || '',
}))

interface Store extends AppState {
  minds: Mind[]
  provider: 'anthropic' | 'openai' | 'openrouter'
  model: string

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

  // Settings
  setApiKey: (key: string) => void
  setProvider: (provider: 'anthropic' | 'openai' | 'openrouter') => void
  setModel: (model: string) => void

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
      // Bug #3 fix: removed NEXT_PUBLIC_ prefix — apiKey is user-supplied, not an env var here
      apiKey: '',
      provider: 'anthropic',
      model: '',
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
        // Ensure all minds have conversation slots
        const updated = { ...conversations }
        for (const m of minds) {
          if (!updated[m.id]) updated[m.id] = []
        }
        set({ conversations: updated })
      },
      logout: () => {
        const convReset: Record<string, Message[]> = {}
        for (const m of MINDS_WITH_CORPUS) convReset[m.id] = []
        // Bug #7 fix: clear apiKey from store and localStorage on logout
        set({
          user: null,
          page: 'landing',
          appView: 'home',
          currentMindId: null,
          conversations: convReset,
          minds: MINDS_WITH_CORPUS,
          apiKey: '',
        })
        // Also purge from localStorage to prevent key leakage
        try {
          const raw = localStorage.getItem('myndzprint-store')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.state) delete parsed.state.apiKey
            localStorage.setItem('myndzprint-store', JSON.stringify(parsed))
          }
        } catch { /* ignore storage errors */ }
      },

      // Minds
      selectMind: (id) => set({ currentMindId: id, appView: 'chat' }),
      updateMindCorpus: (mindId, corpus) => {
        const { minds } = get()
        const updated = minds.map(m => m.id === mindId ? { ...m, corpus } : m)
        set({ minds: updated })
        // Re-index in background
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
        // Only index if not already indexed (BuildModal indexes with progress UI;
        // this covers minds added programmatically without going through BuildModal)
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
      setProvider: (provider) => set({ provider }),
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
      // Bug #2 fix: strip apiKey from partialize so it's never persisted to localStorage.
      // Also strips corpus from persisted minds (~40KB each) — re-attached on rehydration.
      partialize: (s) => ({
        user: s.user,
        // apiKey intentionally omitted — never persisted
        provider: s.provider,
        model: s.model,
        conversations: s.conversations,
        currentMindId: s.currentMindId,
        minds: s.minds.map(m => ({ ...m, corpus: '' })),
      }),
      // Bug #13 fix: use the set function instead of direct mutation on the state object.
      // Direct mutation works in some Zustand versions but is unreliable and not the
      // documented API — use the set callback form instead.
      onRehydrateStorage: () => (state, set) => {
        if (!state || !set) return

        const publicIds = new Set(MINDS_WITH_CORPUS.map(m => m.id))
        const userMinds = (state.minds || [])
          .filter((m: Mind) => !publicIds.has(m.id))
          .map((m: Mind) => ({ ...m, corpus: CORPUS[m.id] || m.corpus || '' }))
        const mergedMinds = [...MINDS_WITH_CORPUS, ...userMinds]

        const convs = { ...(state.conversations || {}) }
        for (const m of mergedMinds) {
          if (!convs[m.id]) convs[m.id] = []
        }

        // Restore page state based on persisted user — page itself isn't persisted
        // so refresh always defaults to 'landing'. Fix: go to app if user exists.
        set({
          minds: mergedMinds,
          conversations: convs,
          ...(state.user ? { page: 'app' as const, appView: state.appView || 'home' as const } : {}),
        })
      },
    }
  )
)
