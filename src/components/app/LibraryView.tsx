'use client'
import { useAppStore } from '@/store/appStore'

export default function LibraryView() {
  const { minds, activeTag, setActiveTag, selectMind } = useAppStore()

  const allTags = ['All', ...Array.from(new Set(minds.flatMap(m => m.tags)))]
  const filtered = activeTag === 'All' ? minds : minds.filter(m => m.tags.includes(activeTag))

  return (
    <div className="content-view active" id="view-library">
      <div className="topbar">
        <span className="topbar-title">Library</span>
      </div>
      <div className="scroll-area">
        <div className="tag-filters" id="tag-filters">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tag-filter${activeTag === tag ? ' active' : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="minds-grid" id="minds-grid">
          {filtered.map(mind => (
            <div key={mind.id} className="mind-card" onClick={() => selectMind(mind.id)} style={{ cursor: 'pointer' }}>
              <div className="card-head">
                <div className="mind-avatar" style={{ width: 38, height: 38, fontSize: 17 }}>{mind.initial}</div>
                <span className="type-badge">{mind.domain}</span>
              </div>
              <div className="mind-name">{mind.name}</div>
              <div className="mind-domain">{mind.era}</div>
              {mind.quote && (
                <div className="mind-quote">&ldquo;{mind.quote.slice(0, 90)}{mind.quote.length > 90 ? '…' : ''}&rdquo;</div>
              )}
              <div className="tags">
                {mind.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
