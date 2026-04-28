'use client'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { ragReply, type ReplyTier } from '@/lib/ragEngine'
import { showToast } from '@/components/ui/Toast'
import IndexBadge from '@/components/ui/IndexBadge'
import { SUGGESTIONS } from '@/data/static'
import type { Message } from '@/types'

const TIER_LABELS: Record<ReplyTier, { label: string; title: string }> = {
  'api-rag':          { label: '⚡ AI · grounded',  title: 'Claude generation grounded in uploaded material' },
  'offline-rag':      { label: '◉ offline · smart', title: 'Semantic search over uploaded material (no API key needed)' },
  'offline-fallback': { label: '○ offline · basic',  title: 'Keyword matching — add source material for better replies' },
}

function TypingDots() {
  return (
    <div className="msg-row assistant">
      <div className="typing-dots" style={{ alignSelf: 'flex-start' }}>
        <span /><span /><span />
      </div>
    </div>
  )
}

export default function ChatView() {
  const { currentMindId, minds, getMessages, addMessage, apiKey } = useAppStore()
  const mind = minds.find(m => m.id === currentMindId)
  const messages = currentMindId ? getMessages(currentMindId) : []
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    setInput('')
    textareaRef.current?.focus()
  }, [currentMindId])

  async function send(text: string) {
    if (!text.trim() || !mind || !currentMindId || typing) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const history = getMessages(currentMindId)
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: Date.now() }
    // Bug #21 fix: include the current user message in history passed to ragReply/localReply
    // so the reply engine can see the full conversation including the message being replied to.
    const historyWithCurrent = [...history, userMsg]
    addMessage(currentMindId, userMsg)
    setTyping(true)

    try {
      const result = await ragReply(mind, text.trim(), historyWithCurrent, apiKey || undefined)
      setTyping(false)
      addMessage(currentMindId, {
        role: 'assistant',
        content: result.reply,
        source: result.source,
        engine: result.tier,
        timestamp: Date.now(),
      })
    } catch (err) {
      setTyping(false)
      showToast('Something went wrong. Try again.')
      console.error(err)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !typing) {
      e.preventDefault()
      send(input)
    }
  }

  function autosize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  if (!mind) {
    return (
      <div className="content-view active" id="view-chat">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
          Select a mind to begin.
        </div>
      </div>
    )
  }

  const suggs = SUGGESTIONS[mind.id] || []

  return (
    <div className="content-view active" id="view-chat">
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="mind-avatar" style={{ width: 36, height: 36, fontSize: 16 }}>{mind.initial}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{mind.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {mind.domain} · {mind.era}
              <IndexBadge mind={mind} />
            </div>
          </div>
        </div>
      </div>

      <div className="messages" id="messages">
        {messages.length === 0 && (
          <div className="msg-row assistant">
            <div className="msg-tag">
              <div className="mind-avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{mind.initial}</div>
              <span className="name">{mind.name}</span>
            </div>
            <div className="bubble assistant">{mind.opening}</div>
          </div>
        )}

        {messages.map((msg, i) => {
          const tierInfo = msg.engine ? TIER_LABELS[msg.engine as ReplyTier] : null
          return (
            <div key={i} className={`msg-row ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="msg-tag">
                  <div className="mind-avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{mind.initial}</div>
                  <span className="name">{mind.name}</span>
                </div>
              )}
              <div className={`bubble ${msg.role}`}>{msg.content}</div>
              {msg.role === 'assistant' && (
                <div className="badges">
                  {msg.source && <span className="source-pill">◆ {msg.source}</span>}
                  {tierInfo && (
                    <span className="engine-badge" title={tierInfo.title}>
                      <span className="dot" />{tierInfo.label}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {typing && <TypingDots />}
        <div ref={messagesEndRef} />
      </div>

      {messages.length === 0 && suggs.length > 0 && (
        <div className="suggestions">
          {suggs.map(s => (
            <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="chat-input-bar">
        <textarea
          ref={textareaRef}
          id="chat-input"
          className="chat-input"
          placeholder={`Ask ${mind.name} anything…`}
          rows={1}
          value={input}
          onChange={autosize}
          onKeyDown={onKeyDown}
        />
        <button
          id="send-btn"
          className="send-btn"
          onClick={() => send(input)}
          disabled={!input.trim() || typing}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      <div className="chat-footer">
        <p className="footer-note">Responses drawn from {mind.name}&rsquo;s documented words and thought.</p>
      </div>
    </div>
  )
}
