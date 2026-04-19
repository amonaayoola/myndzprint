'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { showToast } from '@/components/ui/Toast'

interface MindIndexInfo {
  id: string
  name: string
  status: 'indexed' | 'not-indexed' | 'no-corpus'
  chunkCount?: number
}

export default function SettingsView() {
  const { user, apiKey, setApiKey, minds } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)
  const [indexInfo, setIndexInfo] = useState<MindIndexInfo[]>([])
  const [reindexing, setReindexing] = useState<string | null>(null)

  useEffect(() => {
    loadIndexInfo()
  }, [minds]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const statusColor = (s: string) =>
    s === 'indexed' ? 'var(--green)' : s === 'not-indexed' ? 'var(--gold)' : 'var(--text3)'
  const statusLabel = (s: string) =>
    s === 'indexed' ? '◉ indexed' : s === 'not-indexed' ? '○ not indexed' : '— no corpus'

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

        {/* API Key */}
        <div className="settings-section">
          <div className="settings-label">API</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="t">Anthropic API key</div>
              <div className="s" style={{ fontSize: 12 }}>
                Powers Claude generation and grounded replies. Get one at console.anthropic.com.
              </div>
            </div>
          </div>
          {!editing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>
                {apiKey ? apiKey.slice(0, 8) + '••••••••' : 'Not set'}
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
                placeholder="sk-ant-..."
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

        {/* Index Management */}
        <div className="settings-section">
          <div className="settings-label">Smart search index</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="t">Semantic index</div>
              <div className="s" style={{ fontSize: 12, lineHeight: 1.6 }}>
                Each mind&rsquo;s corpus is chunked and embedded for offline semantic search.
                Re-index if you update a mind&rsquo;s source material.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            {indexInfo.map(info => (
              <div key={info.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
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
                      {reindexing === info.id ? 'Indexing…' : info.status === 'indexed' ? 'Re-index' : 'Index'}
                    </button>
                  )}
                  {info.status === 'indexed' && (
                    <button className="settings-edit-btn" onClick={() => clearIndex(info.id)}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
