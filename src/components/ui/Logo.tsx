export default function Logo({ size = 24 }: { size?: number }) {
  const h = Math.round(size * 32 / 28)
  return (
    <svg width={size} height={h} viewBox="0 0 28 32" fill="none">
      <line x1="4" y1="7"  x2="24" y2="7"  stroke="#b8892a" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="4" y1="13" x2="22" y2="13" stroke="#b8892a" strokeWidth="1.7" strokeLinecap="round" opacity="0.75" />
      <line x1="4" y1="18" x2="18" y2="18" stroke="#b8892a" strokeWidth="1.1" strokeLinecap="round" opacity="0.52" />
      <line x1="4" y1="22" x2="14" y2="22" stroke="#b8892a" strokeWidth="0.7" strokeLinecap="round" opacity="0.34" />
      <circle cx="4" cy="29" r="1.6" fill="#b8892a" opacity="0.45" />
    </svg>
  )
}
