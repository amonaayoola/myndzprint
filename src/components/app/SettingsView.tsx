'use client'
import { useState, useEffect } from 'react'
import { useAppStore, ANTHROPIC_MODELS, OPENAI_MODELS, defaultModelForProvider, type Provider } from '@/store/appStore'
import { showToast } from '@/components/ui/Toast'

interface ServerStatus {
  anthropicConfigured: boolean
  openaiConfigured: boolean
  model: string
}

interface MindIndexInfo {
  id: string
  name: string
  status: 'indexed' | 'not-indexed' | 'no-corpus'
  chunkCount?: number
}

interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing?: { prompt: string; completion: string }
}

export default function SettingsView() {
  const { user, apiKey, setApiKey, provider, setProvider, model, setModel, minds } = useAppStore()

  // Key editing
  const [editing, setEditing] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)

  // Index info
  const [indexInfo, setIndexInfo] = useState<MindIndexInfo[]>([])
  const [reindexing, setReindexing] = useState<string | null>(null)

  // Server status
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)

  // OpenRouter models
  const [orModels, setOrModels] = useState<OpenRouterModel[]>([])
  const [orSearch, setOrSearch] = useState('')
  const [orLoading, setOrLoading] = useState(false)

  // Feedback form
  const [feedbackType, setFeedbackType] = useState<'general' | 'bug' | 'feature'>('general')
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [featureRequest, setFeatureRequest] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState(user?.email || '')
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [exportingFeedback, setExportingFeedback] = useState(false)

  // Admin
  const isAdmin = user?.email === 'amonaayoola@gmail.com'

  // Admin analytics state
  interface AnalyticsData {
    totalEvents: number
    uniqueUsers: number
    pageVisits: number
    signups: number
    logins: number
    totalChats: number
    mindOpens: number
    mindsCreated: number
    mindsRanked: [string, number][]
    dailyVisits: [string, number][]
    byEvent: [string, number][]
  }
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    try {
      const token = process.env.NEXT_PUBLIC_FEEDBACK_EXPORT_TOKEN || ''
      const res = await fetch(`/api/analytics${token ? `?token=${encodeURIComponent(token)}` : ''}`)
      if (res.ok) setAnalytics(await res.json())
    } catch { /* silent */ } finally {
      setAnalyticsLoading(false)
    }
  }

  async function exportFeedback() {
    setExportingFeedback(true)
    try {
      const token = process.env.NEXT_PUBLIC_FEEDBACK_EXPORT_TOKEN || ''
      const url = `/api/feedback/export${token ? `?token=${encodeURIComponent(token)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) { showToast('Export failed.'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `myndzprint-feedback-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      showToast('Export failed.')
    } finally {
      setExportingFeedback(false)
    }
  }

  useEffect(() => {
    loadIndexInfo()
    fetch('/api/status').then(r => r.json()).then(setServerStatus).catch(() => {})
  }, [minds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (provider === 'openrouter') fetchOrModels()
  }, [provider]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOrModels() {
    setOrLoading(true)
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models')
      const data = await res.json()
      const models = (data.data || []) as OpenRouterModel[]
      models.sort((a, b) => a.name.localeCompare(b.name))
      setOrModels(models)
    } catch {
      showToast('Could not load OpenRouter models.')
    } finally {
      setOrLoading(false)
    }
  }

  async function loadIndexInfo() {
    const { getIndexStatus } = await import('@/lib/indexer')
    const { getChunksForMind } = await import('@/lib/vectorStore')
    const info: MindIndexInfo[] = []
    for (const m of minds) {
      const status = await getIndexStatus(m)
      let chunkCount: number | undefined
      if (status === 'indexed') {
        const chunks = await getChunksForMind(m.id)
        chunkCount = chunks.length
      }
      info.push({ id: m.id, name: m.name, status, chunkCount })
    }
    setIndexInfo(info)
  }

  async function reindex(mindId: string) {
    const mind = minds.find(m => m.id === mindId)
    if (!mind) return
    setReindexing(mindId)
    try {
      const { reIndexMind } = await import('@/lib/indexer')
      const count = await reIndexMind(mind, {})
      showToast(`Re-indexed ${mind.name} — ${count} chunks.`)
      await loadIndexInfo()
    } catch (e) {
      showToast('Indexing failed. Check console.')
      console.error(e)
    } finally {
      setReindexing(null)
    }
  }

  async function clearIndex(mindId: string) {
    const mind = minds.find(m => m.id === mindId)
    if (!mind) return
    const { deleteChunksForMind } = await import('@/lib/vectorStore')
    await deleteChunksForMind(mindId)
    showToast(`Cleared index for ${mind.name}.`)
    await loadIndexInfo()
  }

  function saveKey() {
    setApiKey(keyInput.trim())
    setEditing(false)
    showToast('API key saved.')
  }

  function handleProviderChange(p: Provider) {
    setProvider(p)
    setApiKey('')
    setKeyInput('')
    setEditing(false)
    setModel(defaultModelForProvider(p))
  }

  async function submitFeedback() {
    if (!feedbackMsg.trim() && !featureRequest.trim()) {
      showToast('Please write something before sending.')
      return
    }
    setFeedbackSending(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          rating: feedbackRating,
          message: feedbackMsg,
          featureRequest,
          email: feedbackEmail,
        }),
      })
      setFeedbackSent(true)
      setFeedbackMsg('')
      setFeatureRequest('')
      setFeedbackRating(0)
      showToast('Thanks for your feedback.')
    } catch {
      showToast('Could not send feedback. Try again.')
    } finally {
      setFeedbackSending(false)
    }
  }

  const filteredOrModels = orModels.filter(m =>
    !orSearch || m.id.toLowerCase().includes(orSearch.toLowerCase()) || m.name.toLowerCase().includes(orSearch.toLowerCase())
  )

  const statusColor = (s: string) =>
    s === 'indexed' ? 'var(--green)' : s === 'not-indexed' ? 'var(--gold)' : 'var(--text3)'
  const statusLabel = (s: string) =>
    s === 'indexed' ? 'indexed' : s === 'not-indexed' ? 'not indexed' : 'no corpus'

  const providerLabel: Record<Provider, string> = {
    anthropic: 'Anthropic (Claude)',
    openai: 'OpenAI (ChatGPT)',
    openrouter: 'OpenRouter',
  }

  const keyPlaceholder: Record<Provider, string> = {
    anthropic: 'sk-ant-...',
    openai: 'sk-...',
    openrouter: 'sk-or-...',
  }

  const keyLink: Record<Provider, string> = {
    anthropic: 'https://console.anthropic.com',
    openai: 'https://platform.openai.com/api-keys',
    openrouter: 'https://openrouter.ai/keys',
  }

  return (
    <div className="content-view active" id="view-settings">
      <div className="topbar">
        <span className="topbar-title">Settings</span>
      </div>
      <div className="scroll-area">

        {/* Account */}
        <div className="settings-section">
          <div className="settings-label">Account</div>
          <div className="settings-row">
            <div><div className="t">Name</div><div className="s">{user?.name ?? '—'}</div></div>
          </div>
          <div className="settings-row">
            <div><div className="t">Email</div><div className="s">{user?.email ?? '—'}</div></div>
          </div>
        </div>

        {/* Provider selection */}
        <div className="settings-section">
          <div className="settings-label">AI Provider</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="t">Provider</div>
              <div className="s" style={{ fontSize: 12 }}>Choose which AI powers your mind conversations and builds.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, flexWrap: 'wrap' }}>
            {(['anthropic', 'openai', 'openrouter'] as Provider[]).map(p => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: `1.5px solid ${provider === p ? 'var(--gold)' : 'var(--border)'}`,
                  background: provider === p ? 'rgba(212,175,55,0.12)' : 'var(--bg2)',
                  color: provider === p ? 'var(--gold)' : 'var(--text2)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: provider === p ? 600 : 400,
                }}
              >
                {providerLabel[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Model selection */}
        <div className="settings-section">
          <div className="settings-label">Model</div>

          {provider === 'anthropic' && (
            <select
              className="form-input"
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ fontSize: 13, marginTop: 4 }}
            >
              {ANTHROPIC_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          )}

          {provider === 'openai' && (
            <select
              className="form-input"
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ fontSize: 13, marginTop: 4 }}
            >
              {OPENAI_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          )}

          {provider === 'openrouter' && (
            <div style={{ marginTop: 4 }}>
              <input
                className="form-input"
                placeholder="Search models..."
                value={orSearch}
                onChange={e => setOrSearch(e.target.value)}
                style={{ fontSize: 13, marginBottom: 6 }}
              />
              {orLoading ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Loading models...</div>
              ) : (
                <select
                  className="form-input"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  style={{ fontSize: 13 }}
                  size={5}
                >
                  {filteredOrModels.slice(0, 80).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* API key */}
        <div className="settings-section">
          <div className="settings-label">{providerLabel[provider]} API Key</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="s" style={{ fontSize: 12, lineHeight: 1.6 }}>
                Sent through your server only — never directly from the browser.
                Get a key at{' '}
                <a href={keyLink[provider]} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>
                  {keyLink[provider].replace('https://', '')}
                </a>.
              </div>
            </div>
          </div>
          {!editing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>
                {apiKey ? apiKey.slice(0, 10) + '••••••••' : 'Not set'}
              </span>
              <button className="settings-edit-btn" onClick={() => { setKeyInput(apiKey); setEditing(true) }}>
                {apiKey ? 'Change' : 'Add key'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0' }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: 13 }}
                type="text"
                placeholder={keyPlaceholder[provider]}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveKey() }}
                autoFocus
              />
              <button className="settings-edit-btn" onClick={saveKey}>Save</button>
              <button className="settings-edit-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          )}
        </div>

        {/* Server status */}
        {serverStatus && (
          <div className="settings-section">
            <div className="settings-label">Server</div>
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div className="t">Claude (Anthropic)</div>
                <div className="s" style={{ fontSize: 12 }}>
                  {serverStatus.anthropicConfigured ? `Configured — ${serverStatus.model}` : 'Not configured — using personal key'}
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: serverStatus.anthropicConfigured ? 'var(--green)' : 'var(--text3)', flexShrink: 0, marginTop: 4 }} />
            </div>
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div className="t">OpenAI (embeddings)</div>
                <div className="s" style={{ fontSize: 12 }}>
                  {serverStatus.openaiConfigured ? 'Configured — text-embedding-3-small' : 'Not configured — keyword hash fallback active'}
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: serverStatus.openaiConfigured ? 'var(--green)' : 'var(--gold)', flexShrink: 0, marginTop: 4 }} />
            </div>
          </div>
        )}

        {/* Index management */}
        <div className="settings-section">
          <div className="settings-label">Smart search index</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="s" style={{ fontSize: 12, lineHeight: 1.6 }}>
                Each mind is chunked and labeled for semantic retrieval. Re-index after updating source material.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            {indexInfo.map(info => (
              <div key={info.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{info.name}</div>
                  <div style={{ fontSize: 12, color: statusColor(info.status), marginTop: 2 }}>
                    {statusLabel(info.status)}
                    {info.chunkCount !== undefined && ` · ${info.chunkCount} chunks`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {info.status !== 'no-corpus' && (
                    <button
                      className="settings-edit-btn"
                      onClick={() => reindex(info.id)}
                      disabled={reindexing === info.id}
                      style={{ opacity: reindexing === info.id ? 0.5 : 1 }}
                    >
                      {reindexing === info.id ? 'Indexing...' : info.status === 'indexed' ? 'Re-index' : 'Index'}
                    </button>
                  )}
                  {info.status === 'indexed' && (
                    <button className="settings-edit-btn" onClick={() => clearIndex(info.id)}>Clear</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="settings-section">
          <div className="settings-label">Feedback</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="s" style={{ fontSize: 12, lineHeight: 1.6 }}>
                Tell us what is working, what is broken, or what you wish existed. Every message goes directly to the team.
              </div>
            </div>
          </div>

          {feedbackSent ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>
              Thanks. We read every message.
              <button
                style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, cursor: 'pointer' }}
                onClick={() => setFeedbackSent(false)}
              >
                Send another
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>

              {/* Type tabs */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['general', 'bug', 'feature'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFeedbackType(t)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 16,
                      border: `1px solid ${feedbackType === t ? 'var(--gold)' : 'var(--border)'}`,
                      background: feedbackType === t ? 'rgba(212,175,55,0.12)' : 'transparent',
                      color: feedbackType === t ? 'var(--gold)' : 'var(--text2)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'general' ? 'General' : t === 'bug' ? 'Bug' : 'Feature idea'}
                  </button>
                ))}
              </div>

              {/* Star rating */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setFeedbackRating(feedbackRating === n ? 0 : n)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      fontSize: 20, color: n <= feedbackRating ? 'var(--gold)' : 'var(--border)',
                    }}
                  >
                    {n <= feedbackRating ? '★' : '☆'}
                  </button>
                ))}
                {feedbackRating > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>
                    {['', 'Needs work', 'Okay', 'Good', 'Great', 'Love it'][feedbackRating]}
                  </span>
                )}
              </div>

              {/* Message */}
              <textarea
                className="form-input"
                placeholder={feedbackType === 'bug' ? 'What happened? What did you expect?' : feedbackType === 'feature' ? 'Describe what you wish existed...' : 'What is on your mind?'}
                value={feedbackMsg}
                onChange={e => setFeedbackMsg(e.target.value)}
                rows={3}
                style={{ fontSize: 13, resize: 'vertical' }}
              />

              {/* Feature request field — always shown for feature type, optional for others */}
              {(feedbackType === 'feature' || featureRequest) && (
                <input
                  className="form-input"
                  placeholder="One-line summary of the feature (optional)"
                  value={featureRequest}
                  onChange={e => setFeatureRequest(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              )}

              {feedbackType !== 'feature' && !featureRequest && (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  onClick={() => setFeatureRequest(' ')}
                >
                  + Add a feature request
                </button>
              )}

              {/* Email */}
              <input
                className="form-input"
                placeholder="Your email (optional — only if you want a reply)"
                value={feedbackEmail}
                onChange={e => setFeedbackEmail(e.target.value)}
                style={{ fontSize: 13 }}
              />

              <button
                onClick={submitFeedback}
                disabled={feedbackSending}
                style={{
                  padding: '10px 20px',
                  background: 'var(--gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: feedbackSending ? 'not-allowed' : 'pointer',
                  opacity: feedbackSending ? 0.6 : 1,
                  alignSelf: 'flex-start',
                }}
              >
                {feedbackSending ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          )}

          {/* Admin: export all feedback as Excel */}
          {isAdmin && (
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Admin</div>
              <button
                onClick={exportFeedback}
                disabled={exportingFeedback}
                style={{
                  padding: '7px 16px',
                  background: 'transparent',
                  color: 'var(--text2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: exportingFeedback ? 'not-allowed' : 'pointer',
                  opacity: exportingFeedback ? 0.6 : 1,
                }}
              >
                {exportingFeedback ? 'Exporting...' : 'Export feedback as Excel'}
              </button>
            </div>
          )}
        </div>

        {/* Admin Analytics Dashboard */}
        {isAdmin && (
          <div className="settings-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="settings-label">Analytics</div>
              <button
                onClick={loadAnalytics}
                disabled={analyticsLoading}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 7, padding: '4px 12px', fontSize: 12, cursor: analyticsLoading ? 'not-allowed' : 'pointer', opacity: analyticsLoading ? 0.6 : 1 }}
              >
                {analyticsLoading ? 'Loading...' : analytics ? 'Refresh' : 'Load stats'}
              </button>
            </div>

            {analytics && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>
                {/* Top counters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Page Visits', value: analytics.pageVisits },
                    { label: 'Sign Ups', value: analytics.signups },
                    { label: 'Logins', value: analytics.logins },
                    { label: 'Total Chats', value: analytics.totalChats },
                    { label: 'Mind Opens', value: analytics.mindOpens },
                    { label: 'Unique Users', value: analytics.uniqueUsers },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--gold)' }}>{value.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Top minds by messages */}
                {analytics.mindsRanked.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 500 }}>Top Minds by Messages</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {analytics.mindsRanked.slice(0, 10).map(([mindId, count]) => {
                        const mindName = minds.find(m => m.id === mindId)?.name || mindId
                        const max = analytics.mindsRanked[0][1]
                        return (
                          <div key={mindId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontSize: 12, color: 'var(--text2)', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mindName}</div>
                            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: 'var(--gold)', borderRadius: 4 }} />
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text3)', width: 30, textAlign: 'right' }}>{count}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* All event counts */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 500 }}>All Events</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {analytics.byEvent.map(([event, count]) => (
                      <div key={event} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>{event}</span>
                        <span style={{ color: 'var(--text3)' }}>{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!analytics && !analyticsLoading && (
              <div style={{ fontSize: 12, color: 'var(--text3)', paddingTop: 8 }}>Click "Load stats" to see platform analytics.</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
