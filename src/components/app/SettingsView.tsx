'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { showToast } from '@/components/ui/Toast'

type Provider = 'anthropic' | 'openai' | 'openrouter'

interface MindIndexInfo {
  id: string
  name: string
  status: 'indexed' | 'not-indexed' | 'no-corpus'
  chunkCount?: number
}

const ANTHROPIC_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most capable)' },
]

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
]

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
  openrouter: 'OpenRouter',
}

const API_KEY_PLACEHOLDERS: Record<Provider, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  openrouter: 'sk-or-...',
}

const API_KEY_HINTS: Record<Provider, { label: string; url: string }> = {
  anthropic: { label: 'console.anthropic.com', url: 'https://console.anthropic.com' },
  openai: { label: 'platform.openai.com', url: 'https://platform.openai.com/api-keys' },
  openrouter: { label: 'openrouter.ai/keys', url: 'https://openrouter.ai/keys' },
}

export default function SettingsView() {
  const { user, apiKey, setApiKey, provider, model, setProvider, setModel, minds } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)
  const [indexInfo, setIndexInfo] = useState<MindIndexInfo[]>([])
  const [indexError, setIndexError] = useState<string | null>(null)
  const [reindexing, setReindexing] = useState<string | null>(null)
  // Bug #18 fix: debounce timer ref to prevent excessive IDB reads when minds changes rapidly
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void loadIndexInfo() }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [minds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bug #6 fix: wrap all IndexedDB calls in try/catch with user-visible error state
  async function loadIndexInfo() {
    setIndexError(null)
    try {
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
    } catch (e) {
      console.error('loadIndexInfo failed:', e)
      setIndexError('Could not read index status. IndexedDB may be unavailable.')
    }
  }

  async function reindex(mindId: string) {
    const mind = minds.find(m => m.id === mindId)
    if (!mind) return
    setReindexing(mindId)
    // Bug #6 fix: try/catch with user-visible error
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
    // Bug #6 fix: try/catch with user-visible error
    try {
      const { deleteChunksForMind } = await import('@/lib/vectorStore')
      await deleteChunksForMind(mindId)
      showToast(`Cleared index for ${mind.name}.`)
      await loadIndexInfo()
    } catch (e) {
      showToast('Failed to clear index. Check console.')
      console.error(e)
    }
  }

  function saveKey() {
    setApiKey(keyInput.trim())
    setEditing(false)
    showToast('API key saved.')
  }

  function handleProviderChange(p: Provider) {
    setProvider(p)
    // Reset model to default for the new provider
    if (p === 'anthropic') setModel(ANTHROPIC_MODELS[0].value)
    else if (p === 'openai') setModel(OPENAI_MODELS[0].value)
    else setModel('') // OpenRouter: let user type their own
    setEditing(false)
    setKeyInput('')
  }

  const statusColor = (s: string) =>
    s === 'indexed' ? 'var(--green)' : s === 'not-indexed' ? 'var(--gold)' : 'var(--text3)'
  const statusLabel = (s: string) =>
    s === 'indexed' ? '◉ indexed' : s === 'not-indexed' ? '○ not indexed' : '— no corpus'

  const hint = API_KEY_HINTS[provider]

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

        {/* Provider & Model */}
        <div className="settings-section">
          <div className="settings-label">AI Provider</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="t">Provider</div>
              <div className="s" style={{ fontSize: 12 }}>
                Choose which AI service powers your minds.
              </div>
            </div>
          </div>
          <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Provider dropdown */}
            <select
              className="form-input"
              style={{ fontSize: 13 }}
              value={provider}
              onChange={e => handleProviderChange(e.target.value as Provider)}
            >
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>

            {/* Model selector — dropdown for Anthropic/OpenAI, text input for OpenRouter */}
            {provider === 'anthropic' && (
              <div>
                <div className="s" style={{ fontSize: 12, marginBottom: 6 }}>Model</div>
                <select
                  className="form-input"
                  style={{ fontSize: 13 }}
                  value={model || ANTHROPIC_MODELS[0].value}
                  onChange={e => setModel(e.target.value)}
                >
                  {ANTHROPIC_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {provider === 'openai' && (
              <div>
                <div className="s" style={{ fontSize: 12, marginBottom: 6 }}>Model</div>
                <select
                  className="form-input"
                  style={{ fontSize: 13 }}
                  value={model || OPENAI_MODELS[0].value}
                  onChange={e => setModel(e.target.value)}
                >
                  {OPENAI_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {provider === 'openrouter' && (
              <div>
                <div className="s" style={{ fontSize: 12, marginBottom: 6 }}>
                  Model string — e.g. <code style={{ fontSize: 11, opacity: 0.8 }}>google/gemma-3-27b-it</code> or <code style={{ fontSize: 11, opacity: 0.8 }}>meta-llama/llama-3.1-8b-instruct</code>
                </div>
                <input
                  className="form-input"
                  style={{ fontSize: 13 }}
                  type="text"
                  placeholder="google/gemma-3-27b-it"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* API Key */}
        <div className="settings-section">
          <div className="settings-label">API</div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="t">{PROVIDER_LABELS[provider]} API key</div>
              <div className="s" style={{ fontSize: 12 }}>
                Powers AI generation and grounded replies. Get one at{' '}
                <span style={{ textDecoration: 'underline', opacity: 0.7 }}>{hint.label}</span>.
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
                type="password"
                placeholder={API_KEY_PLACEHOLDERS[provider]}
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
          {indexError && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginTop: 8 }}>
              {indexError}
            </div>
          )}
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
