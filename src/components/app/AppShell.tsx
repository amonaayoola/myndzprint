'use client'
import { useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import ChatView from './ChatView'
import LibraryView from './LibraryView'
import Dashboard from './Dashboard'
import SettingsView from './SettingsView'
import { useAppStore } from '@/store/appStore'

export default function AppShell() {
  const appView = useAppStore(s => s.appView)
  const minds = useAppStore(s => s.minds)
  // Bug #12 fix: use a ref to hold the latest minds value so the startup effect
  // doesn't capture a stale closure — the ref is always current.
  const mindsRef = useRef(minds)
  useEffect(() => { mindsRef.current = minds }, [minds])

  useEffect(() => {
    // Preload offline embedding model in background (23MB, cached after first load)
    import('@/lib/embedder').then(({ preloadOfflineModel }) => preloadOfflineModel())

    // Bug #12 fix: read from ref so we get the up-to-date minds list at call time,
    // not the stale snapshot captured when the effect was first registered.
    import('@/lib/indexer').then(({ indexPublicMindsIfNeeded }) => {
      indexPublicMindsIfNeeded(mindsRef.current).catch(console.warn)
    })
  }, []) // intentionally runs once on mount

  return (
    <div className="page app active" id="page-app">
      <div className="app-shell">
        <Sidebar />
        <div className="content-area">
          {appView === 'home' && <Dashboard />}
          {appView === 'chat' && <ChatView />}
          {appView === 'dash' && <LibraryView />}
          {appView === 'settings' && <SettingsView />}
        </div>
      </div>
    </div>
  )
}
