'use client'
import { useEffect, useState } from 'react'
import type { Mind } from '@/types'

type Status = 'indexed' | 'not-indexed' | 'no-corpus' | 'indexing' | 'unknown'

export default function IndexBadge({ mind }: { mind: Mind }) {
  const [status, setStatus] = useState<Status>('unknown')

  useEffect(() => {
    import('@/lib/indexer').then(({ getIndexStatus }) => {
      getIndexStatus(mind).then(s => setStatus(s as Status))
    })
  }, [mind.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'unknown' || status === 'no-corpus') return null

  const cfg = {
    'indexed':     { color: 'var(--green)',  dot: '◉', label: 'smart search ready' },
    'not-indexed': { color: 'var(--text3)',  dot: '○', label: 'not indexed' },
    'indexing':    { color: 'var(--gold)',   dot: '◌', label: 'indexing…' },
  } as const

  const c = cfg[status as keyof typeof cfg]
  if (!c) return null

  return (
    <span style={{ fontSize: 11, color: c.color, display: 'flex', alignItems: 'center', gap: 4 }}>
      {c.dot} {c.label}
    </span>
  )
}
