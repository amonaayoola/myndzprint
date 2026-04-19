'use client'
import { useAppStore } from '@/store/appStore'

export default function Dashboard() {
  const { user, minds, conversations, selectMind, setBuildModalOpen } = useAppStore()

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  const totalMsgs = Object.values(conversations).reduce((s, arr) => s + arr.length, 0)
  const convCount = Object.values(conversations).filter(arr => arr.length > 0).length
  const interactedMinds = minds.filter(m => (conversations[m.id] || []).length > 0)

  return (
    <div className="content-view active" id="view-dash">
      <div className="topbar">
        <span className="topbar-title">Home</span>
        <button className="topbar-action" onClick={() => setBuildModalOpen(true)}>+ Build a mind</button>
      </div>
      <div className="scroll-area">
        <div className="dash-greet">
          <h1 id="dash-greeting">{greet}, {firstName}.</h1>
          <p>Your minds are ready to talk.</p>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <div className="num" id="stat-mymind">{interactedMinds.length || '—'}</div>
            <div className="label">My minds</div>
          </div>
          <div className="stat">
            <div className="num" id="stat-conv">{convCount || '—'}</div>
            <div className="label">Conversations</div>
          </div>
          <div className="stat">
            <div className="num" id="stat-msgs">{totalMsgs || '—'}</div>
            <div className="label">Messages sent</div>
          </div>
        </div>

        <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>My minds</div>

        <div id="dash-my-minds">
          {interactedMinds.length === 0 ? (
            <div className="dash-empty">
              No conversations yet.<br />
              Open a mind from the <strong>Library</strong> and start talking.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {interactedMinds.map(mind => (
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
          )}
        </div>
      </div>
    </div>
  )
}
