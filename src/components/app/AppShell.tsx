'use client'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import ChatView from './ChatView'
import LibraryView from './LibraryView'
import Dashboard from './Dashboard'
import SettingsView from './SettingsView'
import { useAppStore } from '@/store/appStore'

export default function AppShell() {
  const appView = useAppStore(s => s.appView)
  const minds = useAppStore(s => s.minds)

  useEffect(() => {
    // Preload offline embedding model in background (23MB, cached after first load)
    import('@/lib/embedder').then(({ preloadOfflineModel }) => preloadOfflineModel())

    // Index public minds that haven't been indexed yet
    import('@/lib/indexer').then(({ indexPublicMindsIfNeeded }) => {
      indexPublicMindsIfNeeded(minds).catch(console.warn)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
