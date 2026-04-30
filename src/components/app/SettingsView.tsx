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

interface ModelOption {
  value: string
  label: string
}

const ANTHROPIC_MODELS: ModelOption[] = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

const OPENAI_MODELS: ModelOption[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'o1', label: 'o1' },
  { value: 'o1-mini', label: 'o1-mini' },
]

const OPENROUTER_FALLBACK_MODELS: ModelOption[] = [
  { value: 'google/gemma-4-31b-it', label: 'Gemma 4 31B' },
  { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
  { value: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku via OpenRouter' },
  { value: 'google/gemma-3-27b-it', label: 'Gemma 3 27B' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
]

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  openrouter: 'google/gemma-4-31b-it',
}

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

  // OpenRouter live model list
  const [orModels, setOrModels] = useState<ModelOption[]>(OPENROUTER_FALLBACK_MODELS)
  const [orLoading, setOrLoading] = useState(false)
  const [orSearch, setOrSearch] = useState('')
  const [orOpen, setOrOpen] = useState(false)
  const orDropdownRef = useRef<HTMLDivElement>(null)

  // Fetch OpenRouter models when provider is openrouter and apiKey is set
  useEffect(() => {
    if (provider !== 'openrouter' || !apiKey) {
      setOrModels(OPENROUTER_FALLBACK_MODELS)
      return
    }
    setOrLoading(true)
    fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then(r => r.json())
      .then((data: { data: { id: string; name: string }[] }) => {
        if (Array.isArray(data?.data)) {
          setOrModels(data.data.map(m => ({ value: m.id, label: m.name || m.id })))
        }
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setOrLoading(false))
  }, [provider, apiKey])

  // Close OpenRouter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (orDropdownRef.current && !orDropdownRef.current.contains(e.target as Node)) {
        setOrOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    setModel(DEFAULT_MODELS[p])
    // Reset OpenRouter search state
    setOrSearch('')
    setOrOpen(false)
    // Bug fix: clear the stored API key when switching providers so a key
    // for provider A is never sent to provider B (causes 401 from Anthropic
    // when an OpenAI/OpenRouter key is used as x-api-key).
    setApiKey('')
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

            {/* Model selector */}
            {provider === 'anthropic' && (
              <div>
                <div className="s" style={{ fontSize: 12, marginBottom: 6 }}>Model</div>
                <select
                  className="form-input"
                  style={{ fontSize: 13 }}
                  value={model || DEFAULT_MODELS.anthropic}
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
                  value={model || DEFAULT_MODELS.openai}
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
                  Model{orLoading && <span style={{ marginLeft: 6, opacity: 0.5 }}>Loading…</span>}
                </div>
                {/* Searchable dropdown */}
                <div ref={orDropdownRef} style={{ position: 'relative' }}>
                  {/* Trigger button showing current selection */}
                  <button
                    type="button"
                    className="form-input"
                    style={{
                      fontSize: 13,
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 12px',
                    }}
                    onClick={() => { setOrOpen(o => !o); setOrSearch('') }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {orModels.find(m => m.value === model)?.label || model || DEFAULT_MODELS.openrouter}
                    </span>
                    <span style={{ marginLeft: 8, opacity: 0.5, flexShrink: 0 }}>▾</span>
                  </button>

                  {orOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      overflow: 'hidden',
                    }}>
                      {/* Search input */}
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                        <input
                          autoFocus
                          className="form-input"
                          type="text"
                          placeholder="Search models…"
                          value={orSearch}
                          onChange={e => setOrSearch(e.target.value)}
                          style={{ fontSize: 12, width: '100%', padding: '5px 8px' }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      {/* Model list */}
                      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {orModels
                          .filter(m =>
                            !orSearch ||
                            m.label.toLowerCase().includes(orSearch.toLowerCase()) ||
                            m.value.toLowerCase().includes(orSearch.toLowerCase())
                          )
                          .map(m => (
                            <button
                              key={m.value}
                              type="button"
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 14px',
                                fontSize: 13,
                                background: m.value === model ? 'var(--accent-soft, rgba(120,100,255,0.12))' : 'transparent',
                                color: m.value === model ? 'var(--accent, var(--text))' : 'var(--text)',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3, var(--bg2))' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = m.value === model ? 'var(--accent-soft, rgba(120,100,255,0.12))' : 'transparent' }}
                              onClick={() => { setModel(m.value); setOrOpen(false); setOrSearch('') }}
                            >
                              <div style={{ fontWeight: 500 }}>{m.label}</div>
                              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{m.value}</div>
                            </button>
                          ))
                        }
                        {orModels.filter(m =>
                          !orSearch ||
                          m.label.toLowerCase().includes(orSearch.toLowerCase()) ||
                          m.value.toLowerCase().includes(orSearch.toLowerCase())
                        ).length === 0 && (
                          <div style={{ padding: '12px 14px', fontSize: 12, opacity: 0.5, color: 'var(--text2)' }}>
                            No models match &ldquo;{orSearch}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
