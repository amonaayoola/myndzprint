'use client'
import { useEffect, useState } from 'react'

let _showToast: ((msg: string) => void) | null = null

export function showToast(msg: string) {
  _showToast?.(msg)
}

export default function Toast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    _showToast = (m: string) => {
      setMsg(m)
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), 2400)
    }
    return () => { clearTimeout(timer); _showToast = null }
  }, [])

  return (
    <div id="toast" className={visible ? 'visible' : ''}>
      {msg}
    </div>
  )
}
