import { MARQUEE_ITEMS } from '@/data/static'

export default function Marquee() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <div className="marquee-wrap">
      <div className="marquee" id="marquee">
        {doubled.map((item, i) => (
          <span key={i} className="item">
            {item}<span className="dot">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
