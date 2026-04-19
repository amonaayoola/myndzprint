'use client'
import { useEffect, useRef } from 'react'

const COLS = 28, ROWS = 18
const STIFFNESS = 0.28, DAMPING = 0.82, MOUSE_RADIUS = 120, MOUSE_FORCE = 2.2

interface Node {
  ox: number; oy: number; x: number; y: number; vx: number; vy: number
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    let nodes: Node[] = []
    let W = 0, H = 0, cellW = 0, cellH = 0
    let rafId: number

    function buildGrid() {
      W = canvas!.width = canvas!.offsetWidth
      H = canvas!.height = canvas!.offsetHeight
      cellW = W / (COLS - 1)
      cellH = H / (ROWS - 1)
      nodes = []
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          nodes.push({ ox: c * cellW, oy: r * cellH, x: c * cellW, y: r * cellH, vx: 0, vy: 0 })
        }
      }
    }

    const n = (r: number, c: number) => nodes[r * COLS + c]

    function step() {
      const mx = mouseRef.current.x, my = mouseRef.current.y
      for (const nd of nodes) {
        const fx = (nd.ox - nd.x) * STIFFNESS
        const fy = (nd.oy - nd.y) * STIFFNESS
        const dx = nd.x - mx, dy = nd.y - my
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        let emx = 0, emy = 0
        if (dist < MOUSE_RADIUS) {
          const str = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE * cellW
          emx = (dx / dist) * str; emy = (dy / dist) * str
        }
        nd.vx = (nd.vx + fx + emx) * DAMPING
        nd.vy = (nd.vy + fy + emy) * DAMPING
        nd.x += nd.vx; nd.y += nd.vy
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H)
      for (let r = 0; r < ROWS; r++) {
        const step = Math.max(1, Math.floor(ROWS / 9))
        if (r % step !== 0) continue
        const alpha = 0.06 + 0.04 * (1 - r / ROWS)
        ctx.beginPath()
        ctx.moveTo(n(r, 0).x, n(r, 0).y)
        for (let c = 1; c < COLS; c++) {
          const prev = n(r, c - 1), curr = n(r, c)
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2)
        }
        ctx.strokeStyle = `rgba(184,137,42,${alpha})`
        ctx.lineWidth = 0.8; ctx.stroke()
      }
      for (let c = 0; c < COLS; c++) {
        const step = Math.max(1, Math.floor(COLS / 14))
        if (c % step !== 0) continue
        const alpha = 0.04 + 0.03 * (1 - c / COLS)
        ctx.beginPath()
        ctx.moveTo(n(0, c).x, n(0, c).y)
        for (let r = 1; r < ROWS; r++) {
          const prev = n(r - 1, c), curr = n(r, c)
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2)
        }
        ctx.strokeStyle = `rgba(212,170,96,${alpha})`
        ctx.lineWidth = 0.6; ctx.stroke()
      }
      for (let r = 0; r < ROWS; r += 3) {
        for (let c = 0; c < COLS; c += 4) {
          const nd = n(r, c)
          const dx = nd.x - nd.ox, dy = nd.y - nd.oy
          const disp = Math.sqrt(dx * dx + dy * dy)
          if (disp > 1.5) {
            ctx.beginPath()
            ctx.arc(nd.x, nd.y, Math.min(disp * 0.08, 1.4), 0, Math.PI * 2)
            ctx.fillStyle = `rgba(184,137,42,${Math.min(disp * 0.025, 0.18)})`
            ctx.fill()
          }
        }
      }
    }

    function loop() { step(); draw(); rafId = requestAnimationFrame(loop) }

    buildGrid()
    loop()

    const onResize = () => buildGrid()
    window.addEventListener('resize', onResize)

    const hero = canvas.parentElement!
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 } }
    const onTouch = (e: TouchEvent) => {
      if (!e.touches[0]) return
      const r = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }
    }
    hero.addEventListener('mousemove', onMove)
    hero.addEventListener('mouseleave', onLeave)
    hero.addEventListener('touchmove', onTouch, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      hero.removeEventListener('mousemove', onMove)
      hero.removeEventListener('mouseleave', onLeave)
      hero.removeEventListener('touchmove', onTouch)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, mixBlendMode: 'multiply' }}
    />
  )
}
