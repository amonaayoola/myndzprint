'use client'
import { useState, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMindViaAPI } from '@/lib/claudeApi'
import { buildMindLocally } from '@/lib/buildMind'
import { indexMind } from '@/lib/indexer'
import { showToast } from '@/components/ui/Toast'

type MindType = 'personal' | 'community' | 'public'
type BuildPhase = 'form1' | 'form2' | 'building' | 'indexing' | 'done' | 'error'
type UploadTab = 'text' | 'file' | 'voice'

export default function BuildModal() {
  const { buildModalOpen, setBuildModalOpen, apiKey, provider, model, addMind, user } = useAppStore()
  const [phase, setPhase] = useState<BuildPhase>('form1')
  const [type, setType] = useState<MindType>('personal')
  const [name, setName] = useState('')
  const [era, setEra] = useState('')
  const [description, setDescription] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [error, setError] = useState('')
  const [indexProgress, setIndexProgress] = useState(0)
  const [result, setResult] = useState<ReturnType<typeof buildMindLocally> | null>(null)

  // Upload state
  const [uploadTab, setUploadTab] = useState<UploadTab>('text')
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const voiceInputRef = useRef<HTMLInputElement>(null)

  function close() {
    setBuildModalOpen(false)
    setTimeout(() => { setPhase('form1'); setResult(null); setError(''); setIndexProgress(0) }, 300)
  }

  function reset() {
    setPhase('form1'); setType('personal'); setName(''); setEra('')
    setDescription(''); setSourceText(''); setResult(null); setError(''); setIndexProgress(0)
    setUploadTab('text'); setUploadStatus('idle'); setUploadMessage('')
  }

  // ── File upload (TXT, PDF, DOCX) ─────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('processing')
    setUploadMessage('Reading file…')

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'txt' || ext === 'md') {
        // Plain text — read directly in browser
        const text = await file.text()
        setSourceText(prev => prev ? prev + '\n\n' + text : text)
        setUploadStatus('done')
        setUploadMessage(`✓ ${file.name} imported (${Math.round(text.length / 1000)}k chars)`)

      } else if (ext === 'pdf') {
        // PDF — send to API route for extraction
        setUploadMessage('Extracting PDF text…')
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'PDF extraction failed')
        setSourceText(prev => prev ? prev + '\n\n' + data.text : data.text)
        setUploadStatus('done')
        setUploadMessage(`✓ ${file.name} imported (${Math.round(data.text.length / 1000)}k chars)`)

      } else if (ext === 'docx') {
        // DOCX — send to API route for extraction
        setUploadMessage('Extracting Word document text…')
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'DOCX extraction failed')
        setSourceText(prev => prev ? prev + '\n\n' + data.text : data.text)
        setUploadStatus('done')
        setUploadMessage(`✓ ${file.name} imported (${Math.round(data.text.length / 1000)}k chars)`)

      } else {
        throw new Error('Unsupported file type. Upload TXT, PDF, or DOCX.')
      }
    } catch (err: unknown) {
      setUploadStatus('error')
      setUploadMessage((err as Error).message || 'Upload failed.')
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Voice upload (MP3, M4A, WAV, WEBM) ───────────────────────────────────
  const hasOpenAIKey = apiKey && provider === 'openai' && apiKey.trim().startsWith('sk-')

  async function handleVoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!hasOpenAIKey) return

    setUploadStatus('processing')
    setUploadMessage('Transcribing voice note…')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('apiKey', apiKey)

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Transcription failed')

      setSourceText(prev => prev ? prev + '\n\n' + data.text : data.text)
      setUploadStatus('done')
      setUploadMessage(`✓ Voice note transcribed (${Math.round(data.text.length / 100) * 100} chars)`)
    } catch (err: unknown) {
      setUploadStatus('error')
      setUploadMessage((err as Error).message || 'Transcription failed.')
    }

    if (voiceInputRef.current) voiceInputRef.current.value = ''
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  async function generate() {
    setPhase('building'); setError('')
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    try {
      let built
      if (apiKey && apiKey.trim().length > 10) {
        built = await buildMindViaAPI({ id, name, era, type, description, sourceText, apiKey, provider, model })
      } else {
        await new Promise(r => setTimeout(r, 600))
        built = buildMindLocally({ id, name, era, type, description, sourceText })
      }
      if (user?.email) built = { ...built, ownerEmail: user.email }
      setResult(built as ReturnType<typeof buildMindLocally>)

      if (sourceText.trim().length > 50 || description.trim().length > 50) {
        setPhase('indexing')
        setIndexProgress(0)
        await indexMind(built, {}, (p) => setIndexProgress(Math.round(p.progress * 100)))
      }

      setPhase('done')

      // Publish to community if public
      if (type === 'public' && user?.email) {
        try {
          await fetch('/api/community-minds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...built, ownerEmail: user.email }),
          })
        } catch { /* non-fatal */ }
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Something went wrong.')
      setPhase('error')
    }
  }

  function openMind() {
    if (!result) return
    addMind(result)
    close()
    showToast(result.name + ' is ready.')
  }

  if (!buildModalOpen) return null

  const stepLabel = phase === 'form1' ? 'Step 1 of 2'
    : phase === 'form2' ? 'Step 2 of 2'
    : phase === 'building' ? 'Building the mind…'
    : phase === 'indexing' ? 'Indexing for smart search…'
    : phase === 'done' ? 'Your mind is ready.'
    : 'Something went wrong.'

  return (
    <div className="modal-overlay visible" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="modal-card">
        <div className="modal-head">
          <div className="modal-step">{stepLabel}</div>
          <div className="modal-title">
            {phase === 'form1' ? 'Build a mind' : phase === 'form2' ? 'Add detail' : ''}
          </div>
          {(phase === 'form1' || phase === 'form2') && (
            <div className="modal-progress">
              <div className={`pip${phase === 'form1' || phase === 'form2' ? ' active' : ''}`} />
              <div className={`pip${phase === 'form2' ? ' active' : ''}`} />
            </div>
          )}
          <button onClick={close} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }}>✕</button>
        </div>

        <div className="modal-body">
          {/* ── Step 1 ── */}
          {phase === 'form1' && (
            <>
              <div className="modal-label">Who is this mind?</div>
              <input className="modal-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
              <div className="modal-label" style={{ marginTop: 14 }}>Era or context</div>
              <input className="modal-input" placeholder="e.g. My grandmother · Nigeria · 1940s" value={era} onChange={e => setEra(e.target.value)} />
              <div className="modal-label" style={{ marginTop: 14 }}>Type</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {(['personal', 'community', 'public'] as MindType[]).map(t => (
                  <button key={t} className={`type-card${type === t ? ' active' : ''}`} onClick={() => setType(t)} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{t}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Step 2 ── */}
          {phase === 'form2' && (
            <>
              <div className="modal-label">Description</div>
              <textarea
                className="modal-textarea"
                rows={3}
                placeholder={`Who is ${name || 'this person'}? What did they stand for?`}
                value={description}
                onChange={e => setDescription(e.target.value)}
                autoFocus
              />

              <div className="modal-label" style={{ marginTop: 14 }}>
                Source material
                <span style={{ color: 'var(--gold)', fontSize: 12, marginLeft: 8 }}>powers smart replies</span>
              </div>

              {/* Upload tabs */}
              <div className="upload-tabs">
                {(['text', 'file', 'voice'] as UploadTab[]).map(tab => (
                  <button
                    key={tab}
                    className={`upload-tab${uploadTab === tab ? ' active' : ''}`}
                    onClick={() => { setUploadTab(tab); setUploadStatus('idle'); setUploadMessage('') }}
                  >
                    {tab === 'text' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    )}
                    {tab === 'file' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    )}
                    {tab === 'voice' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    )}
                    {tab === 'text' ? 'Paste text' : tab === 'file' ? 'Upload file' : 'Voice note'}
                  </button>
                ))}
              </div>

              {/* Tab: paste text */}
              {uploadTab === 'text' && (
                <textarea
                  className="modal-textarea"
                  rows={6}
                  placeholder="Paste letters, writings, speeches, diary entries, interviews — anything in their voice."
                  value={sourceText}
                  onChange={e => setSourceText(e.target.value)}
                />
              )}

              {/* Tab: upload file */}
              {uploadTab === 'file' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <div
                    className={`upload-dropzone${uploadStatus === 'processing' ? ' processing' : ''}`}
                    onClick={() => uploadStatus !== 'processing' && fileInputRef.current?.click()}
                  >
                    {uploadStatus === 'processing' ? (
                      <>
                        <div className="typing-dots" style={{ justifyContent: 'center', margin: '0 auto 8px' }}><span /><span /><span /></div>
                        <div className="upload-dropzone-label">{uploadMessage}</div>
                      </>
                    ) : (
                      <>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.4, marginBottom: 8 }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <div className="upload-dropzone-label">Click to upload a file</div>
                        <div className="upload-dropzone-hint">TXT, PDF, or DOCX · No size limit</div>
                      </>
                    )}
                  </div>
                  {uploadStatus === 'done' && (
                    <div className="upload-status-msg success">{uploadMessage}</div>
                  )}
                  {uploadStatus === 'error' && (
                    <div className="upload-status-msg error">{uploadMessage}</div>
                  )}
                  {sourceText.trim().length > 0 && uploadStatus !== 'processing' && (
                    <div className="upload-corpus-preview">
                      <span>{sourceText.length.toLocaleString()} characters loaded</span>
                      <button onClick={() => { setSourceText(''); setUploadStatus('idle'); setUploadMessage('') }}>Clear</button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: voice note */}
              {uploadTab === 'voice' && (
                <div>
                  <input
                    ref={voiceInputRef}
                    type="file"
                    accept="audio/mp3,audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/webm,audio/*"
                    style={{ display: 'none' }}
                    onChange={handleVoiceUpload}
                  />
                  {!hasOpenAIKey ? (
                    <div className="upload-locked">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.4 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                      <div className="upload-locked-title">OpenAI key required</div>
                      <div className="upload-locked-body">
                        Voice transcription uses OpenAI's Whisper API. Go to <strong>Settings</strong>, switch your provider to OpenAI, and add your key. Then come back here.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        className={`upload-dropzone${uploadStatus === 'processing' ? ' processing' : ''}`}
                        onClick={() => uploadStatus !== 'processing' && voiceInputRef.current?.click()}
                      >
                        {uploadStatus === 'processing' ? (
                          <>
                            <div className="typing-dots" style={{ justifyContent: 'center', margin: '0 auto 8px' }}><span /><span /><span /></div>
                            <div className="upload-dropzone-label">{uploadMessage}</div>
                          </>
                        ) : (
                          <>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.4, marginBottom: 8 }}>
                              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                            <div className="upload-dropzone-label">Click to upload a voice note</div>
                            <div className="upload-dropzone-hint">MP3, M4A, WAV, or WEBM · Transcribed via Whisper</div>
                          </>
                        )}
                      </div>
                      {uploadStatus === 'done' && (
                        <div className="upload-status-msg success">{uploadMessage}</div>
                      )}
                      {uploadStatus === 'error' && (
                        <div className="upload-status-msg error">{uploadMessage}</div>
                      )}
                      {sourceText.trim().length > 0 && uploadStatus !== 'processing' && (
                        <div className="upload-corpus-preview">
                          <span>{sourceText.length.toLocaleString()} characters loaded</span>
                          <button onClick={() => { setSourceText(''); setUploadStatus('idle'); setUploadMessage('') }}>Clear</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: apiKey ? 'rgba(184,137,42,0.07)' : 'var(--bg2)', border: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {apiKey ? '⚡ API path — Claude generates + semantic search' : '◉ Offline path — semantic search over your material'}
                </div>
                <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>
                  {apiKey
                    ? 'Claude will build the mind persona and ground every reply in your uploaded material.'
                    : 'Your material will be indexed for offline semantic search. Replies will be drawn directly from what you upload. Add an API key in Settings for generative replies.'}
                </div>
              </div>
            </>
          )}

          {phase === 'building' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="typing-dots" style={{ justifyContent: 'center' }}><span /><span /><span /></div>
              <p style={{ color: 'var(--text2)', marginTop: 16, fontSize: 14 }}>Building {name}…</p>
            </div>
          )}

          {phase === 'indexing' && (
            <div style={{ padding: '32px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16, textAlign: 'center' }}>
                Indexing your material for smart search…
              </p>
              <div style={{ background: 'var(--bg2)', borderRadius: 8, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${indexProgress}%`, background: 'var(--gold)',
                  borderRadius: 8, transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>{indexProgress}%</p>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="build-result-card">
              <div className="name">{result.name}</div>
              <div className="era">{result.era}</div>
              {result.opening && <div className="opening">&ldquo;{result.opening}&rdquo;</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {result.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
              </div>
              {sourceText.trim().length > 50 && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> Indexed and ready for semantic search
                </div>
              )}
              {type === 'public' && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🌐</span> Published — visible to all Myndzprint users
                </div>
              )}
            </div>
          )}

          {phase === 'error' && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px 16px', borderRadius: 10, fontSize: 14 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          {phase === 'form2' && (
            <button className="modal-btn" onClick={() => setPhase('form1')}>Back</button>
          )}
          {phase === 'form1' && (
            <button className="modal-btn primary" disabled={!name.trim()} onClick={() => setPhase('form2')}>Continue</button>
          )}
          {phase === 'form2' && (
            <button className="modal-btn primary" disabled={!description.trim() || uploadStatus === 'processing'} onClick={generate}>
              Build this mind
            </button>
          )}
          {phase === 'done' && (
            <button className="modal-btn gold" onClick={openMind}>Open this mind →</button>
          )}
          {phase === 'error' && (
            <button className="modal-btn primary" onClick={reset}>Try again</button>
          )}
        </div>
      </div>
    </div>
  )
}
