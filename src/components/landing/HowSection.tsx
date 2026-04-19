export default function HowSection() {
  return (
    <section id="how" className="how-section texture">
      <div className="how-inner">
        <div className="eyebrow reveal">Three kinds of minds</div>
        <h2 className="how-h2 reveal">Any mind.<br /><em>Anyone&rsquo;s</em> mind.</h2>
        <p className="how-lede reveal">
          A platform for making any mind reachable, anywhere, any time, at any hour. Not a memorial. A live line.
        </p>
        <div className="how-grid">
          <div className="how-card reveal">
            <div className="num">01</div>
            <h3>Public minds</h3>
            <p>Philosophers, strategists, scientists, leaders. Their documented thinking made interactive. Marcus Aurelius on a Tuesday. Nietzsche at midnight. On your terms.</p>
          </div>
          <div className="how-card reveal reveal-delay-1">
            <div className="num">02</div>
            <h3>Personal minds</h3>
            <p>A parent. A mentor. A teacher who shaped you. Upload their messages, letters, voice notes, writings. They become reachable, whenever you need to ask, whenever you need to hear them.</p>
          </div>
          <div className="how-card reveal reveal-delay-2">
            <div className="num">03</div>
            <h3>Community minds</h3>
            <p>Publish your own mind. An expert scaling beyond their calendar. A creator letting every reader have the one-on-one they would never otherwise get. Thinking, distributed.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
