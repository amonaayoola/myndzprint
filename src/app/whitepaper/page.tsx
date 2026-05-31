import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Myndzprint — Founder\'s White Paper 2026',
}

export default function WhitepaperPage() {
  return (
    <>
      <style>{`
        :root {
          --wp-gold:    #B8860B;
          --wp-gold-lt: #C9A84C;
          --wp-dark:    #1A1008;
          --wp-mid:     #3D2B0D;
          --wp-light:   #6B4E1A;
          --wp-body:    #2C2C2C;
          --wp-subtle:  #666666;
          --wp-offwht:  #FDF8F0;
          --wp-cream:   #F9F4EC;
          --wp-border:  #E8DCC8;
          --wp-white:   #ffffff;
        }

        .wp-root *, .wp-root *::before, .wp-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .wp-root { font-family: 'DM Sans', system-ui, sans-serif; font-size: 16px; line-height: 1.7; color: var(--wp-body); background: var(--wp-white); }

        /* ── NAV ── */
        .wp-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--wp-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 56px;
        }
        .wp-nav-brand {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--wp-dark);
          text-decoration: none;
        }
        .wp-nav-label {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--wp-gold);
          text-transform: uppercase;
        }

        /* ── COVER ── */
        .wp-cover {
          min-height: 100vh;
          background: var(--wp-dark);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 80px 40px 60px;
          position: relative;
          overflow: hidden;
        }
        .wp-cover::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 40%, #3D2B0D44, transparent);
        }
        .wp-cover-kicker {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: var(--wp-gold-lt);
          text-transform: uppercase;
          margin-bottom: 28px;
          position: relative;
        }
        .wp-cover-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(56px, 10vw, 96px);
          font-weight: 700;
          color: var(--wp-white);
          line-height: 1.0;
          margin-bottom: 20px;
          position: relative;
        }
        .wp-cover-sub {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(18px, 2.5vw, 24px);
          font-style: italic;
          color: var(--wp-gold-lt);
          margin-bottom: 60px;
          position: relative;
        }
        .wp-cover-divider {
          width: 80px;
          height: 2px;
          background: var(--wp-gold);
          margin: 0 auto 60px;
          position: relative;
        }
        .wp-cover-tagline {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(18px, 2vw, 22px);
          font-style: italic;
          color: rgba(255,255,255,0.75);
          max-width: 600px;
          line-height: 1.6;
          margin-bottom: 80px;
          position: relative;
        }
        .wp-cover-meta {
          display: flex;
          gap: 48px;
          position: relative;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 32px;
        }
        .wp-cover-meta-item { text-align: center; }
        .wp-meta-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin-bottom: 4px;
        }
        .wp-meta-value {
          font-size: 15px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }

        /* ── TOC ── */
        .wp-toc-section {
          background: var(--wp-cream);
          padding: 80px 40px;
        }
        .wp-toc-inner {
          max-width: 720px;
          margin: 0 auto;
        }
        .wp-toc-section h2 {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--wp-gold);
          margin-bottom: 32px;
        }
        .wp-toc-list { list-style: none; }
        .wp-toc-list li {
          border-bottom: 1px solid var(--wp-border);
        }
        .wp-toc-list li a {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 0;
          text-decoration: none;
          color: var(--wp-dark);
          font-size: 15px;
          transition: color 0.2s;
        }
        .wp-toc-list li a:hover { color: var(--wp-gold); }
        .wp-toc-num {
          font-size: 11px;
          font-weight: 600;
          color: var(--wp-gold-lt);
          letter-spacing: 0.08em;
          margin-right: 16px;
          flex-shrink: 0;
        }
        .wp-toc-title { flex: 1; font-weight: 500; }
        .wp-toc-arrow { color: var(--wp-border); font-size: 14px; }

        /* ── MAIN CONTENT ── */
        .wp-main { max-width: 780px; margin: 0 auto; padding: 0 40px 100px; }

        /* ── SECTION ── */
        .wp-section {
          padding-top: 80px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--wp-border);
          margin-bottom: 20px;
        }
        .wp-section:last-child { border-bottom: none; }

        .wp-section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--wp-gold);
          margin-bottom: 16px;
          display: block;
        }

        .wp-section-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 700;
          color: var(--wp-dark);
          line-height: 1.2;
          margin-bottom: 24px;
        }

        .wp-section-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(to right, var(--wp-gold) 0%, var(--wp-border) 100%);
          margin-bottom: 40px;
        }

        .wp-subsection-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--wp-mid);
          margin: 40px 0 12px;
        }

        .wp-sub-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--wp-light);
          margin: 32px 0 10px;
        }

        .wp-root p {
          margin-bottom: 16px;
          font-size: 16px;
          line-height: 1.8;
          color: var(--wp-body);
        }

        /* ── PULL QUOTE ── */
        .wp-pull-quote {
          margin: 40px 0;
          padding: 24px 32px;
          border-left: 4px solid var(--wp-gold);
          background: var(--wp-offwht);
          border-radius: 0 8px 8px 0;
        }
        .wp-pull-quote p {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 20px;
          font-style: italic;
          color: var(--wp-mid);
          line-height: 1.6;
          margin: 0;
        }

        /* ── BULLETS ── */
        .wp-content-list {
          list-style: none;
          margin: 8px 0 24px 0;
          padding: 0;
        }
        .wp-content-list li {
          padding: 6px 0 6px 24px;
          position: relative;
          font-size: 16px;
          line-height: 1.7;
          color: var(--wp-body);
        }
        .wp-content-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 16px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--wp-gold);
        }

        /* ── TWO COL ── */
        .wp-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin: 32px 0;
        }
        .wp-two-col-item {
          padding: 24px;
          background: var(--wp-cream);
          border: 1px solid var(--wp-border);
          border-radius: 8px;
        }

        /* ── STAT CARDS ── */
        .wp-stat-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin: 32px 0;
        }
        .wp-stat-card {
          text-align: center;
          padding: 28px 16px;
          background: var(--wp-offwht);
          border: 1px solid var(--wp-gold-lt);
          border-radius: 8px;
        }
        .wp-stat-value {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--wp-gold);
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .wp-stat-desc {
          font-size: 12px;
          color: var(--wp-subtle);
          line-height: 1.4;
        }

        /* ── B2B TABLE ── */
        .wp-b2b-table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 15px;
        }
        .wp-b2b-table tr { border-bottom: 1px solid var(--wp-border); }
        .wp-b2b-table tr:nth-child(odd) td { background: var(--wp-cream); }
        .wp-b2b-table tr:nth-child(even) td { background: var(--wp-white); }
        .wp-b2b-table td {
          padding: 16px 20px;
          vertical-align: top;
        }
        .wp-b2b-table td:first-child {
          font-weight: 700;
          color: var(--wp-dark);
          width: 32%;
          white-space: nowrap;
        }
        .wp-b2b-table td:last-child { color: var(--wp-body); }

        /* ── COMPARISON TABLE ── */
        .wp-compare-table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 14px;
        }
        .wp-compare-table th, .wp-compare-table td {
          padding: 12px 16px;
          border: 1px solid var(--wp-border);
          vertical-align: top;
          line-height: 1.5;
        }
        .wp-compare-table thead th {
          background: var(--wp-dark);
          color: var(--wp-white);
          font-weight: 600;
          font-size: 13px;
        }
        .wp-compare-table thead th:last-child {
          background: var(--wp-gold);
        }
        .wp-compare-table tbody tr:nth-child(odd) td { background: var(--wp-cream); }
        .wp-compare-table tbody tr:nth-child(even) td { background: var(--wp-white); }
        .wp-compare-table tbody tr:nth-child(odd) td:last-child { background: #FDF8F0; }
        .wp-compare-table tbody tr:nth-child(even) td:last-child { background: #FBF5E8; }
        .wp-compare-table tbody td:first-child { font-weight: 700; color: var(--wp-dark); }
        .wp-compare-table tbody td:nth-child(2) { color: var(--wp-subtle); }
        .wp-compare-table tbody td:last-child { font-weight: 700; color: var(--wp-light); }

        /* ── PRICING TABLE ── */
        .wp-pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin: 32px 0;
        }
        .wp-pricing-card {
          padding: 28px 24px;
          border: 1px solid var(--wp-border);
          border-radius: 10px;
          background: var(--wp-cream);
        }
        .wp-pricing-card.featured {
          border-color: var(--wp-gold);
          background: var(--wp-offwht);
          position: relative;
        }
        .wp-pricing-card.featured::before {
          content: 'Most Popular';
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--wp-gold);
          color: white;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 12px;
          border-radius: 20px;
        }
        .wp-pricing-tier {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: var(--wp-dark);
          margin-bottom: 6px;
        }
        .wp-pricing-card.featured .wp-pricing-tier { color: var(--wp-gold); }
        .wp-pricing-subtitle {
          font-size: 12px;
          font-weight: 500;
          color: var(--wp-subtle);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .wp-pricing-desc {
          font-size: 14px;
          color: var(--wp-body);
          line-height: 1.6;
          margin: 0;
        }

        /* ── FOUNDER SIGN-OFF ── */
        .wp-signoff {
          text-align: right;
          margin-top: 40px;
          padding-top: 32px;
          border-top: 1px solid var(--wp-border);
        }
        .wp-signoff-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--wp-dark);
          margin-bottom: 4px;
        }
        .wp-signoff-title {
          font-size: 14px;
          font-style: italic;
          color: var(--wp-subtle);
          margin-bottom: 4px;
        }
        .wp-signoff-email {
          font-size: 14px;
          color: var(--wp-gold);
          text-decoration: none;
        }
        .wp-signoff-email:hover { text-decoration: underline; }

        /* ── FOOTER ── */
        .wp-footer {
          background: var(--wp-dark);
          color: rgba(255,255,255,0.5);
          text-align: center;
          padding: 40px;
          font-size: 13px;
        }
        .wp-footer-brand {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--wp-white);
          display: block;
          margin-bottom: 8px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 640px) {
          .wp-nav { padding: 0 20px; }
          .wp-main { padding: 0 20px 60px; }
          .wp-cover { padding: 80px 24px 48px; }
          .wp-cover-meta { gap: 24px; flex-wrap: wrap; justify-content: center; }
          .wp-toc-section { padding: 60px 24px; }
          .wp-two-col { grid-template-columns: 1fr; }
          .wp-stat-cards { grid-template-columns: 1fr 1fr; }
          .wp-pricing-grid { grid-template-columns: 1fr; }
          .wp-compare-table { font-size: 13px; }
          .wp-compare-table th, .wp-compare-table td { padding: 8px 10px; }
        }

        @media print {
          .wp-nav { display: none; }
          .wp-cover { min-height: auto; page-break-after: always; }
          .wp-section { page-break-inside: avoid; }
        }
      `}</style>

      <div className="wp-root">
        <nav className="wp-nav">
          <a className="wp-nav-brand" href="#">Myndzprint</a>
          <span className="wp-nav-label">Founder&rsquo;s White Paper · 2026</span>
        </nav>

        <section className="wp-cover" id="top">
          <span className="wp-cover-kicker">Founder&rsquo;s White Paper</span>
          <h1 className="wp-cover-title">Myndzprint</h1>
          <p className="wp-cover-sub">What It Is. Why It Exists. Where It&rsquo;s Going.</p>
          <div className="wp-cover-divider"></div>
          <p className="wp-cover-tagline">
            The people who shaped how you think: what would they say about what you&rsquo;re facing right now?
          </p>
          <div className="wp-cover-meta">
            <div className="wp-cover-meta-item">
              <div className="wp-meta-label">Company</div>
              <div className="wp-meta-value">Myndzprint</div>
            </div>
            <div className="wp-cover-meta-item">
              <div className="wp-meta-label">Author</div>
              <div className="wp-meta-value">Amona Ayoola, Founder</div>
            </div>
            <div className="wp-cover-meta-item">
              <div className="wp-meta-label">Year</div>
              <div className="wp-meta-value">2026</div>
            </div>
          </div>
        </section>

        <section className="wp-toc-section">
          <div className="wp-toc-inner">
            <h2>Contents</h2>
            <ol className="wp-toc-list">
              <li><a href="#s01"><span className="wp-toc-num">01</span><span className="wp-toc-title">The Problem Nobody Is Talking About</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s02"><span className="wp-toc-num">02</span><span className="wp-toc-title">What Myndzprint Actually Is</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s03"><span className="wp-toc-num">03</span><span className="wp-toc-title">How It Works</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s04"><span className="wp-toc-num">04</span><span className="wp-toc-title">Who Myndzprint Is For</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s05"><span className="wp-toc-num">05</span><span className="wp-toc-title">Why This Moment</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s06"><span className="wp-toc-num">06</span><span className="wp-toc-title">What Makes Myndzprint Different</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s07"><span className="wp-toc-num">07</span><span className="wp-toc-title">The Product, In Detail</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s08"><span className="wp-toc-num">08</span><span className="wp-toc-title">Business Model</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s09"><span className="wp-toc-num">09</span><span className="wp-toc-title">Ethics and Trust</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s10"><span className="wp-toc-num">10</span><span className="wp-toc-title">The Vision: Where This Goes</span><span className="wp-toc-arrow">→</span></a></li>
              <li><a href="#s11"><span className="wp-toc-num">11</span><span className="wp-toc-title">A Note From the Founder</span><span className="wp-toc-arrow">→</span></a></li>
            </ol>
          </div>
        </section>

        <main className="wp-main">

          <article className="wp-section" id="s01">
            <span className="wp-section-label">Section 01</span>
            <h1 className="wp-section-title">The Problem Nobody Is Talking About</h1>
            <div className="wp-section-divider"></div>

            <p>There is a knowledge crisis hiding in plain sight.</p>
            <p>It is not that information is scarce. If anything, information is overwhelming. The real problem is that most people cannot access the kind of thinking that actually changes their decisions.</p>
            <p>Let me explain what I mean.</p>

            <h3 className="wp-sub-label">The Gap Between Information and Insight</h3>
            <p>When you are facing a hard problem: a business decision, a creative block, a question about your field: you do not need more articles. You need to think alongside someone who has been there. Someone who has developed a point of view through years of experience, failure, and refinement.</p>
            <p>The people who think at that level are rare. And they are inaccessible to most people.</p>
            <p>If you want to learn from Marcus Aurelius, you read Meditations: a filtered, translated, edited version of his journal, stripped of the back-and-forth that makes learning real. If you want to talk to Richard Feynman, you watch lectures. Monologues. Performances. Not conversations.</p>
            <p>And if you want to access the thinking of a living expert: a founder who has built what you are trying to build, a scientist in the exact field you are studying: you are usually blocked by time, cost, geography, or access.</p>

            <div className="wp-pull-quote"><p>The best thinking in human history is locked behind static formats. Books, lectures, articles. Formats designed to broadcast, not to converse.</p></div>

            <p>Myndzprint exists to change that. Not to replace those formats. To extend them: into something alive, responsive, and genuinely useful.</p>

            <h3 className="wp-sub-label">Why This Matters More Than Ever</h3>
            <p>We live in a moment where AI is promising to democratise knowledge. And it is: to a point. General AI assistants like ChatGPT and Claude can answer questions across any domain. They are extraordinary tools.</p>
            <p>But they have a fundamental limitation: they are generalised. They do not think like Marcus Aurelius thought. They do not approach a business problem the way Charlie Munger would. They synthesise: they do not embody.</p>
            <p>The difference between a generalised answer and an expert&rsquo;s answer is not just accuracy. It is perspective. Mental models. The particular lens through which a thinker filters reality.</p>
            <p>That is what we are building. Not another assistant. A platform for perspective.</p>
          </article>

          <article className="wp-section" id="s02">
            <span className="wp-section-label">Section 02</span>
            <h1 className="wp-section-title">What Myndzprint Actually Is</h1>
            <div className="wp-section-divider"></div>

            <p>Myndzprint is an AI minds platform.</p>
            <p>A mind on Myndzprint is a conversational AI built to think, respond, and reason like a specific person: a historical figure, a domain expert, a living thinker, or yourself.</p>
            <p>It is not a chatbot. It is not a search engine. It is not a knowledge base with a chat interface bolted on.</p>
            <p>It is the closest thing to sitting across the table from a thinker and asking them anything.</p>

            <h3 className="wp-sub-label">The Core Concept: A Mind</h3>
            <p>When we use the word &ldquo;mind&rdquo; at Myndzprint, we mean it precisely.</p>
            <p>A mind is built from the actual material that shaped a thinker&rsquo;s worldview: their writing, their speeches, their interviews, their frameworks, their stated principles. We feed that material into a purpose-built model and the result is a version of that thinker: one that can engage in real, coherent, nuanced conversation.</p>
            <p>Ask Marcus Aurelius about leadership under pressure. Ask Naval Ravikant about your startup pricing strategy. Ask Wole Soyinka about the themes in your essay. Ask a version of yourself: trained on your own notes and experiences: what you actually believe about a problem you&rsquo;re wrestling with.</p>
            <p>Every response stays grounded in how that person actually thought. It is not hallucination. It is simulation backed by source material.</p>

            <h3 className="wp-sub-label">The Three Types of Minds</h3>

            <div className="wp-two-col">
              <div className="wp-two-col-item">
                <h3 className="wp-sub-label" style={{marginTop: 0}}>Historical Figures</h3>
                <p>The thinkers, leaders, and creators who shaped human civilisation. Philosophers, scientists, strategists, artists. People whose ideas remain relevant centuries after their death: now available for direct conversation.</p>
                <p style={{marginBottom: 0}}><em>Examples: Marcus Aurelius, Ada Lovelace, Nikola Tesla, Chinua Achebe, Sun Tzu.</em></p>
              </div>
              <div className="wp-two-col-item">
                <h3 className="wp-sub-label" style={{marginTop: 0}}>Living Experts</h3>
                <p>Domain experts and thought leaders who are actively shaping their fields. Entrepreneurs, academics, investors, creatives. People whose perspectives are valuable but whose time is scarce.</p>
                <p style={{marginBottom: 0}}><em>Examples: A leading oncologist. A startup founder who has exited twice. An economist specialising in African markets.</em></p>
              </div>
            </div>

            <p>The third type of mind: and perhaps the most powerful: is you.</p>

            <h3 className="wp-sub-label">Your Own Mind</h3>
            <p>Myndzprint lets you build a mind of yourself.</p>
            <p>Upload your notes, your writing, your voice recordings, your frameworks. Train a version of you that has access to everything you have thought about and written over time. Then use it: to reflect, to pressure-test ideas, to onboard teammates into how you think, or to share your perspective at scale.</p>

            <div className="wp-pull-quote"><p>Most people carry more insight than they can access in the moment. A mind of yourself is a way to never lose that thinking.</p></div>

            <p>For founders, consultants, educators, and creators, this is not a gimmick. It is a genuine productivity and legacy tool.</p>
          </article>

          <article className="wp-section" id="s03">
            <span className="wp-section-label">Section 03</span>
            <h1 className="wp-section-title">How It Works</h1>
            <div className="wp-section-divider"></div>

            <p>The technology behind Myndzprint is sophisticated. The experience should feel simple.</p>
            <p>Here is how a mind is built and how it functions.</p>

            <h3 className="wp-sub-label">Step 1: Source Material</h3>
            <p>Every mind begins with source material: the raw intellectual output of the person being built. This includes:</p>
            <ul className="wp-content-list">
              <li>Books, essays, and published writing</li>
              <li>Speeches, interviews, and transcripts</li>
              <li>Letters, journals, and private correspondence</li>
              <li>Recorded lectures and documented frameworks</li>
              <li>For living subjects or the user themselves: uploaded notes, voice recordings, and documents</li>
            </ul>

            <h3 className="wp-sub-label">Step 2: Mind Construction</h3>
            <p>The source material is processed through Myndzprint&rsquo;s mind-building pipeline. This is not simple fine-tuning. We are extracting and encoding:</p>
            <ul className="wp-content-list">
              <li>Characteristic vocabulary and linguistic patterns</li>
              <li>Core beliefs and stated principles</li>
              <li>Typical mental models and reasoning structures</li>
              <li>Known positions on key topics</li>
              <li>The emotional register and tone of the thinker</li>
            </ul>
            <p>The result is a model that does not just know what the person knew: it approximates how they would think about something new.</p>

            <h3 className="wp-sub-label">Step 3: Conversation</h3>
            <p>Users interact with minds through a natural conversation interface. No prompts required. No instructions. Just questions.</p>
            <p>The mind responds in character: drawing on its source material, maintaining consistency with the thinker&rsquo;s known worldview, and flagging where it is speculating beyond its source.</p>
            <p>Conversations can be deep. A user might spend thirty minutes working through a business problem with a version of Charlie Munger. Or a student might interrogate Plato&rsquo;s arguments on justice across three sessions.</p>

            <div className="wp-pull-quote"><p>The measure of a good mind is not whether it gives you information. It is whether it changes how you think.</p></div>
          </article>

          <article className="wp-section" id="s04">
            <span className="wp-section-label">Section 04</span>
            <h1 className="wp-section-title">Who Myndzprint Is For</h1>
            <div className="wp-section-divider"></div>

            <p>Myndzprint is not for everyone. It is for people who take their thinking seriously.</p>
            <p>Let me describe them.</p>

            <div className="wp-stat-cards">
              <div className="wp-stat-card"><div className="wp-stat-value">Curious</div><div className="wp-stat-desc">People who read to think, not just to finish</div></div>
              <div className="wp-stat-card"><div className="wp-stat-value">Ambitious</div><div className="wp-stat-desc">People building something that matters</div></div>
              <div className="wp-stat-card"><div className="wp-stat-value">Reflective</div><div className="wp-stat-desc">People who want to know themselves better</div></div>
              <div className="wp-stat-card"><div className="wp-stat-value">Serious</div><div className="wp-stat-desc">People who treat growth like a discipline</div></div>
            </div>

            <h3 className="wp-sub-label">Individual Users</h3>
            <p>The primary user is someone who is building something: a business, a career, a body of knowledge: and wants access to the kind of thinking that is normally reserved for people with expensive networks or Ivy League connections.</p>
            <p>They use Myndzprint to:</p>
            <ul className="wp-content-list">
              <li>Think through decisions with minds that have been there before</li>
              <li>Study a field by conversing with its greatest practitioners</li>
              <li>Build and consult their own mind as a thinking partner</li>
              <li>Access perspectives that challenge and sharpen their own</li>
            </ul>

            <h3 className="wp-sub-label">B2B: Organisations</h3>
            <p>Myndzprint has a significant B2B opportunity. Organisations sit on enormous reserves of institutional knowledge: in the heads of their founders, their subject matter experts, their most experienced employees.</p>
            <p>When those people leave, the knowledge walks out with them. When the organisation scales, the knowledge does not scale with it.</p>
            <p>Myndzprint lets organisations build minds from their people and material:</p>

            <table className="wp-b2b-table">
              <tbody>
                <tr><td>Internal Knowledge Base</td><td>Build minds from founders, SMEs, and internal documentation. New hires onboard faster. Institutional knowledge never walks out the door.</td></tr>
                <tr><td>Community Voices</td><td>Publish minds of trusted contributors and community leaders. Let your audience access their thinking at any time, at scale.</td></tr>
                <tr><td>Customer-Facing AI</td><td>Give your customers a mind that thinks like your best support rep, advisor, or product expert: grounded in your actual content.</td></tr>
              </tbody>
            </table>

            <h3 className="wp-sub-label">Educational Institutions</h3>
            <p>For schools and universities, Myndzprint offers something genuinely new: the ability to put students in conversation with the thinkers they are studying. Not reading about Socrates: talking to him. Not watching a Feynman lecture: asking him to explain it differently.</p>
            <p>Learning changes when it becomes a dialogue.</p>
          </article>

          <article className="wp-section" id="s05">
            <span className="wp-section-label">Section 05</span>
            <h1 className="wp-section-title">Why This Moment</h1>
            <div className="wp-section-divider"></div>

            <p>This is not a product that could have been built five years ago. Three converging forces have made it possible now.</p>

            <h3 className="wp-sub-label">1. The Foundation Model Moment</h3>
            <p>The emergence of large language models: GPT-4, Claude, Gemini and others: has created a foundation that did not exist before. These models can maintain character, sustain long context, reason across complex topics, and adapt to nuanced prompting.</p>
            <p>We are not building the model. We are building on top of the model: and that is the right decision. Our value is in what we layer on top: the mind construction methodology, the source material curation, the conversation design, and the product experience.</p>

            <h3 className="wp-sub-label">2. The Content Abundance Problem</h3>
            <p>There has never been more content in human history. And there has never been a harder time to find the thinking that actually matters.</p>
            <p>Myndzprint is not adding to the noise. It is converting the best existing content into interactive intelligence. Every book, every speech, every essay that goes into a mind becomes more valuable: not less: because it can now be accessed in conversation rather than in isolation.</p>

            <h3 className="wp-sub-label">3. The Democratisation of Access</h3>
            <p>There is a profound inequality in the world of ideas. People with the right networks and the right institutions get access to the best thinkers. Everyone else gets filtered, packaged, secondhand versions.</p>
            <p>Myndzprint is an access play. A student in Lagos should be able to think alongside the same minds as a student at Harvard. A first-generation entrepreneur should have access to the same calibre of perspective as someone whose parents ran companies.</p>

            <div className="wp-pull-quote"><p>Myndzprint does not level the playing field. It changes the game entirely.</p></div>
          </article>

          <article className="wp-section" id="s06">
            <span className="wp-section-label">Section 06</span>
            <h1 className="wp-section-title">What Makes Myndzprint Different</h1>
            <div className="wp-section-divider"></div>

            <p>There are other AI products in this space. Let me be precise about the difference.</p>

            <table className="wp-compare-table">
              <thead>
                <tr>
                  <th></th>
                  <th>General AI Assistants</th>
                  <th>Myndzprint</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Perspective</td><td>Synthesised from all training data</td><td>Grounded in one specific thinker</td></tr>
                <tr><td>Character</td><td>Generic assistant persona</td><td>Authentic to the source material</td></tr>
                <tr><td>Use Case</td><td>Answer questions, complete tasks</td><td>Think alongside a specific mind</td></tr>
                <tr><td>Depth</td><td>Broad but shallow on any one thinker</td><td>Deep on one person&rsquo;s worldview</td></tr>
                <tr><td>Emotional Register</td><td>Neutral, corporate</td><td>Matches the thinker&rsquo;s actual voice</td></tr>
                <tr><td>Memory Over Time</td><td>Session-based</td><td>Persistent learning per mind (roadmap)</td></tr>
              </tbody>
            </table>

            <p>The comparison is not meant to diminish general AI. These tools are extraordinary. But they are not built to do what Myndzprint does. And we are not trying to do what they do.</p>
            <p>We are a specialised product serving a specific use case: access to specific minds, in depth, with character.</p>
          </article>

          <article className="wp-section" id="s07">
            <span className="wp-section-label">Section 07</span>
            <h1 className="wp-section-title">The Product, In Detail</h1>
            <div className="wp-section-divider"></div>

            <h3 className="wp-sub-label">The Conversation Interface</h3>
            <p>The primary interface is a clean, focused conversation. No clutter. No sidebar of features competing for attention. Just you and the mind.</p>
            <p>The design philosophy is deliberate: we want the conversation to feel different from a Google search or a ChatGPT session. It should feel like sitting down with someone.</p>
            <p>We have invested in the quality of the conversation experience: the pacing, the response structure, the way the mind maintains character over a long session. Small things that compound into a feeling of genuine engagement.</p>

            <h3 className="wp-sub-label">The Mind Library</h3>
            <p>Myndzprint will host a growing library of pre-built minds: curated, quality-controlled, and regularly updated as new source material is available.</p>
            <p>These are not quick builds. Each mind goes through a construction and review process. We would rather have fewer minds that are genuinely good than many minds that are shallow.</p>

            <h3 className="wp-sub-label">Build Your Own Mind</h3>
            <p>Users and organisations can build minds through the Myndzprint platform. The process is:</p>
            <ul className="wp-content-list">
              <li>Upload source material: documents, transcripts, audio, notes</li>
              <li>Define the scope and parameters of the mind</li>
              <li>Review and test through a conversation interface</li>
              <li>Publish privately (personal use), to an organisation, or publicly to the Myndzprint library</li>
            </ul>

            <h3 className="wp-sub-label">Memory and Learning (Roadmap)</h3>
            <p>The next phase of the product introduces persistent memory per mind. Every conversation with a mind builds a shared history: the mind learns what you care about, what you have already covered, and how your thinking has evolved.</p>
            <p>This transforms Myndzprint from a conversation tool into a genuine thinking partnership over time.</p>
            <p>We are also building wiki-style knowledge layers per mind: structured knowledge that grows as users interact, building a living document of what the mind knows and has been taught.</p>
          </article>

          <article className="wp-section" id="s08">
            <span className="wp-section-label">Section 08</span>
            <h1 className="wp-section-title">Business Model</h1>
            <div className="wp-section-divider"></div>

            <p>Myndzprint operates on a freemium model with clear upgrade paths for individuals and enterprise.</p>

            <div className="wp-pricing-grid">
              <div className="wp-pricing-card">
                <div className="wp-pricing-tier">Free</div>
                <div className="wp-pricing-subtitle">Access the library</div>
                <p className="wp-pricing-desc">Limited conversations per month with any mind in the library.</p>
              </div>
              <div className="wp-pricing-card featured">
                <div className="wp-pricing-tier">Pro</div>
                <div className="wp-pricing-subtitle">Unlimited + Build</div>
                <p className="wp-pricing-desc">Unlimited conversations. Build and publish your own mind. Persistent memory. Early access to new minds.</p>
              </div>
              <div className="wp-pricing-card">
                <div className="wp-pricing-tier">Enterprise</div>
                <div className="wp-pricing-subtitle">Organisations</div>
                <p className="wp-pricing-desc">Custom mind builds from internal material. Private deployment. Team access management. Priority support.</p>
              </div>
            </div>

            <p>The long-term revenue model is anchored in enterprise. Individual subscriptions build the brand and community. Enterprise contracts build the business.</p>
            <p>We are also exploring a marketplace model where creators and experts can publish minds and earn a share of the revenue generated by their mind&rsquo;s conversations.</p>
          </article>

          <article className="wp-section" id="s09">
            <span className="wp-section-label">Section 09</span>
            <h1 className="wp-section-title">Ethics and Trust</h1>
            <div className="wp-section-divider"></div>

            <p>We do not take this lightly.</p>
            <p>Building minds of real people: living or historical: comes with serious responsibilities. Let me be explicit about how we think about them.</p>

            <h3 className="wp-sub-label">Consent and Permissions</h3>
            <p>For living subjects, Myndzprint operates with explicit consent. No mind of a living person is built without their participation or the authorisation of a legitimate rights holder.</p>
            <p>For historical figures, we work within the public domain and are guided by scholarly standards: using only publicly available, verified source material.</p>

            <h3 className="wp-sub-label">Accuracy and Transparency</h3>
            <p>A mind is not perfect. It is an approximation. We are transparent about this: every mind interaction includes clear labelling that users are engaging with an AI-powered simulation, not the person themselves.</p>
            <p>Where a mind is speculating beyond its source material, it says so. We are building in uncertainty disclosure as a product feature, not hiding it.</p>

            <h3 className="wp-sub-label">Misuse Prevention</h3>
            <p>We have strict guardrails against generating content that would defame, misrepresent, or harm the subjects of our minds. No mind will be weaponised to put damaging words in someone&rsquo;s mouth.</p>
            <p>Our moderation and audit infrastructure is built from the beginning, not bolted on after the fact.</p>

            <div className="wp-pull-quote"><p>Trust is the product. Everything else is the means of delivering it.</p></div>
          </article>

          <article className="wp-section" id="s10">
            <span className="wp-section-label">Section 10</span>
            <h1 className="wp-section-title">The Vision: Where This Goes</h1>
            <div className="wp-section-divider"></div>

            <p>I want to say something direct about where I believe Myndzprint goes.</p>
            <p>We are building infrastructure for human thought.</p>
            <p>In five years, Myndzprint is the place where serious people come to think. Not to consume content: to think. They come to pressure-test their ideas against the greatest minds in their field. They come to access perspectives they could not otherwise access. They come to build and consult versions of themselves that know everything they have ever thought.</p>
            <p>In ten years, every significant thinker: living or historical: has a mind on Myndzprint. Universities integrate Myndzprint into their curricula. Organisations build internal knowledge systems on our infrastructure. The idea of learning from a book alone feels like a strange limitation, the way reading by candlelight does now.</p>

            <div className="wp-pull-quote"><p>We are not building a product. We are building a new layer of civilisational memory.</p></div>

            <h3 className="wp-sub-label">Why Africa Matters Here</h3>
            <p>I am building this from Nigeria. That is not incidental to the vision: it is central to it.</p>
            <p>Africa has produced extraordinary thinkers whose minds are underrepresented in global intellectual infrastructure. Chinua Achebe. Wole Soyinka. Patrice Lumumba. Nelson Mandela. Thomas Sankara. The scientific and philosophical traditions of civilisations that predate most of what the West calls classical.</p>
            <p>Myndzprint is a platform where those minds can live alongside Aristotle and Darwin and Einstein: not as curios. They belong as essential voices in the conversation.</p>
            <p>We are not playing catch-up. We are building something the world has never had.</p>
          </article>

          <article className="wp-section" id="s11">
            <span className="wp-section-label">Section 11</span>
            <h1 className="wp-section-title">A Note From the Founder</h1>
            <div className="wp-section-divider"></div>

            <p>I started Myndzprint because I kept running into the same wall.</p>
            <p>I am a builder. I think a lot about strategy, about product, about how to grow things. And I am always asking: what would someone who has done this before say about it right now? Not a general answer. Not a Google search. A real conversation with someone who has the specific experience I need.</p>
            <p>That conversation is almost never available.</p>
            <p>The people who have it are expensive, busy, or no longer alive. The next best thing: books, lectures, case studies: is one-directional. You can learn from them but you cannot talk back.</p>
            <p>Myndzprint is my answer to that wall.</p>
            <p>I have built products before. I have run marketing for organisations. I know what it means to take something from idea to market. And I am more convinced about this than anything I have worked on.</p>
            <p>The idea is simple enough to understand in a sentence. The execution is hard enough that most people will not try. And the timing is right enough that the people who do try now will own the space.</p>
            <p>We are at the beginning. If you are reading this, you are early.</p>

            <div className="wp-signoff">
              <div className="wp-signoff-name">Amona Ayoola</div>
              <div className="wp-signoff-title">Founder, Myndzprint</div>
              <a className="wp-signoff-email" href="mailto:hello@myndzprint.com">hello@myndzprint.com</a>
            </div>
          </article>

        </main>

        <footer className="wp-footer">
          <span className="wp-footer-brand">Myndzprint</span>
          <span>myndzprint.com &nbsp;·&nbsp; 2026 &nbsp;·&nbsp; Founder&rsquo;s White Paper</span>
        </footer>
      </div>
    </>
  )
}
