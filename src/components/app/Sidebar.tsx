'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { useAppStore } from '@/store/appStore'
import type { Mind } from '@/types'

const NAV_ITEMS = [
  { view: 'home' as const, label: 'Home', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { view: 'chat' as const, label: 'Chat', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )},
  { view: 'dash' as const, label: 'Library', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )},
  { view: 'settings' as const, label: 'Settings', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )},
]

function hashTag(mind: Mind): string {
  if (mind.mindNumber != null) {
    return `#${String(mind.mindNumber).padStart(3, '0')}`
  }
  // Generate a stable 3-digit hash from the mind id for user/community minds
  let h = 0
  for (let i = 0; i < mind.id.length; i++) h = (h * 31 + mind.id.charCodeAt(i)) >>> 0
  return `#${String(h % 900 + 100)}`
}

function matchesSearch(mind: Mind, q: string): boolean {
  const s = q.toLowerCase()
  const tag = hashTag(mind)
  return (
    mind.name.toLowerCase().includes(s) ||
    mind.domain?.toLowerCase().includes(s) ||
    mind.era?.toLowerCase().includes(s) ||
    mind.tags?.some(t => t.toLowerCase().includes(s)) ||
    tag.toLowerCase().includes(s)
  )
}

export default function Sidebar() {
  const router = useRouter()
  const { appView, setAppView, user, logout, minds, currentMindId, selectMind, setBuildModalOpen } = useAppStore()
  const [search, setSearch] = useState('')

  const publicMinds = minds.filter(m => m.type === 'public' && !m.ownerEmail)
  const builtMinds = minds.filter(m => m.type !== 'public' || m.ownerEmail)

  const q = search.trim()
  const filteredPublic = useMemo(() => q ? publicMinds.filter(m => matchesSearch(m, q)) : publicMinds, [publicMinds, q])
  const filteredBuilt = useMemo(() => q ? builtMinds.filter(m => matchesSearch(m, q)) : builtMinds, [builtMinds, q])

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <Logo size={20} style={{ flexShrink: 0 }} />
        <div className="sb-brand" style={{ minWidth: 0 }}>
          <div className="name" style={{ whiteSpace: 'nowrap' }}>
            Myndz<span>print</span>
          </div>
        </div>
      </div>

      <nav className="sb-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            className={`sb-nav-item${appView === item.view ? ' active' : ''}`}
            onClick={() => setAppView(item.view)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Search bar */}
      <div className="sb-search-wrap">
        <svg className="sb-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="sb-search"
          type="text"
          placeholder="Search minds or #001…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="sb-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
        )}
      </div>

      <div className="sb-section-label">Public minds</div>
      <div className="sb-minds">
        {filteredPublic.length === 0 && q && (
          <div className="sb-empty">No match</div>
        )}
        {filteredPublic.map(mind => (
          <button
            key={mind.id}
            className={`sb-mind-item${currentMindId === mind.id ? ' active' : ''}`}
            onClick={() => selectMind(mind.id)}
          >
            <div className="mind-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{mind.initial}</div>
            <span className="sb-mind-name">{mind.name}</span>
            <span className="sb-mind-hash">{hashTag(mind)}</span>
          </button>
        ))}
      </div>

      {(filteredBuilt.length > 0 || builtMinds.length > 0) && (
        <>
          <div className="sb-section-label">My minds</div>
          <div className="sb-minds">
            {filteredBuilt.length === 0 && q ? (
              <div className="sb-empty">No match</div>
            ) : filteredBuilt.map(mind => (
              <button
                key={mind.id}
                className={`sb-mind-item${currentMindId === mind.id ? ' active' : ''}`}
                onClick={() => selectMind(mind.id)}
              >
                <div className="mind-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{mind.initial}</div>
                <span className="sb-mind-name">{mind.name}</span>
                <span className="sb-mind-hash">{hashTag(mind)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="sb-build-btn" onClick={() => setBuildModalOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Build a mind
      </button>

      <div className="sb-user">
        <div className="sb-user-avatar">{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</div>
        <div className="sb-user-info">
          <div className="sb-user-name">{user?.name ?? 'Guest'}</div>
          <div className="sb-user-email">{user?.email ?? ''}</div>
        </div>
        <button className="sb-logout" onClick={() => { logout(); router.push('/') }} title="Sign out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
