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
        set({
          user: null,
          page: 'landing',
          appView: 'home',
          currentMindId: null,
          conversations: convReset,
          minds: MINDS_WITH_CORPUS,
        })
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

      // Build
      setBuildState: (updates) => set(s => ({ buildState: { ...s.buildState, ...updates } })),
      resetBuild: () => set({ buildState: defaultBuildState }),

      // Modals
      setEarlyAccessOpen: (open) => set({ earlyAccessOpen: open }),
      setBuildModalOpen: (open) => set({ buildModalOpen: open }),
    }),
    {
      name: 'myndzprint-store',
      // Bug 5: strip corpus from persisted minds (~40KB each) — re-attached on rehydration
      partialize: (s) => ({
        user: s.user,
        apiKey: s.apiKey,
        conversations: s.conversations,
        currentMindId: s.currentMindId,
        minds: s.minds.map(m => ({ ...m, corpus: '' })),
      }),
      // Bug 6: re-merge corpus from static source after every rehydration so
      // public minds always have fresh data and user-built minds keep theirs
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Restore page state based on persisted user — page itself isn't persisted
        // so refresh always defaults to 'landing'. Fix: go to app if user exists.
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
      },
    }
  )
)
