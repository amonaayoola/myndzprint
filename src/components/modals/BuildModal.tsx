'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { buildMindViaAPI } from '@/lib/claudeApi'
import { buildMindLocally } from '@/lib/buildMind'
import { indexMind } from '@/lib/indexer'
import { showToast } from '@/components/ui/Toast'

type MindType = 'personal' | 'community' | 'public'

type BuildPhase = 'form1' | 'form2' | 'building' | 'indexing' | 'done' | 'error'

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

  function close() {
    setBuildModalOpen(false)
    setTimeout(() => { setPhase('form1'); setResult(null); setError(''); setIndexProgress(0) }, 300)
  }

  function reset() {
    setPhase('form1'); setType('personal'); setName(''); setEra('')
    setDescription(''); setSourceText(''); setResult(null); setError(''); setIndexProgress(0)
  }

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
      // Bug #20 fix: stamp ownerEmail so sidebar can guard user minds from public section
      if (user?.email) built = { ...built, ownerEmail: user.email }

      setResult(built as ReturnType<typeof buildMindLocally>)

      // Index if there's source material
      if (sourceText.trim().length > 50 || description.trim().length > 50) {
        setPhase('indexing')
        setIndexProgress(0)
        await indexMind(
          built,
          {},
          (p) => setIndexProgress(Math.round(p.progress * 100))
        )
      }

      setPhase('done')
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

          {phase === 'form2' && (
            <>
              <div className="modal-label">Description</div>
              <textarea className="modal-textarea" rows={3} placeholder={`Who is ${name || 'this person'}? What did they stand for?`} value={description} onChange={e => setDescription(e.target.value)} autoFocus />
              <div className="modal-label" style={{ marginTop: 14 }}>
                Source material
                <span style={{ color: 'var(--gold)', fontSize: 12, marginLeft: 8 }}>powers smart replies</span>
              </div>
              <textarea className="modal-textarea" rows={6} placeholder="Paste letters, writings, speeches, diary entries, interviews — anything in their voice. The more you add, the better the mind." value={sourceText} onChange={e => setSourceText(e.target.value)} />
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

          {(phase === 'building') && (
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
                  height: '100%',
                  width: `${indexProgress}%`,
                  background: 'var(--gold)',
                  borderRadius: 8,
                  transition: 'width 0.3s ease',
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
            <button className="modal-btn primary" disabled={!description.trim()} onClick={generate}>Build this mind</button>
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
