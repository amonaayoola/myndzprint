# Myndzprint

> Any mind. Any time. Any place.

A platform for making any mind reachable — historical thinkers, personal mentors, community voices. Built with Next.js, Zustand, and a three-tier reply engine that works offline.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How it works

### Three-tier reply engine

Every message goes through a priority chain:

| Tier | Requires | Quality | Description |
|------|----------|---------|-------------|
| `⚡ AI · grounded` | Anthropic API key | Best | RAG retrieval + Claude generation grounded in uploaded source material |
| `◉ offline · smart` | Source material uploaded | Good | Semantic search over uploaded material using `all-MiniLM-L6-v2` running in-browser |
| `○ offline · basic` | Nothing | Fair | Keyword + fuzzy matching against pre-written brain entries |

The offline embedding model (~23MB) is downloaded once from Hugging Face and cached in the browser. No server required.

### Building a mind

1. Click **Build a mind** in the sidebar
2. Name the person, set their era/context, pick a type (personal / community / public)
3. Add a description and paste source material — letters, writings, speeches, diary entries
4. The system chunks and indexes the material immediately for semantic search
5. Add an Anthropic API key in Settings for Claude-generated replies grounded in that material

### Mind types

- **Public** — Historical figures and thinkers (Marcus Aurelius, Nietzsche, Mandela, Angelou included)
- **Personal** — A parent, mentor, or anyone you have material from
- **Community** — Publish your own mind for your audience

---

## Project structure

```
src/
├── app/                    # Next.js app router
│   ├── globals.css         # All styles
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── App.tsx             # Client-side page router
│   ├── landing/            # Landing page, hero, navbar, marquee
│   ├── app/                # Authenticated shell, chat, dashboard, settings
│   ├── modals/             # Early access, build-a-mind
│   └── ui/                 # Toast, Logo, IndexBadge
├── data/
│   ├── minds.ts            # 4 public minds with full brain entries
│   ├── corpus.ts           # Source material for public minds
│   └── static.ts           # Hero phrases, taglines, marquee items
├── lib/
│   ├── ragEngine.ts        # ← Primary reply path. Three-tier RAG.
│   ├── embedder.ts         # Offline (Transformers.js) + OpenAI embedding backends
│   ├── indexer.ts          # Chunk → embed → save to IndexedDB
│   ├── chunker.ts          # Sentence-aware corpus splitter with overlap
│   ├── vectorStore.ts      # IndexedDB persistence + cosine similarity
│   ├── replyEngine.ts      # Tier 3 fallback: keyword + fuzzy + synonym matching
│   ├── buildMind.ts        # Local mind builder (no API)
│   └── claudeApi.ts        # Claude API: build mind via API
├── store/
│   └── appStore.ts         # Zustand store with localStorage persistence
└── types/
    └── index.ts            # TypeScript interfaces
```

---

## Configuration

### API key

Add your Anthropic API key in **Settings** inside the app. It is stored in `localStorage` and never sent to any server other than `api.anthropic.com`.

### Environment variables (optional)

None required for basic use. If you want to pre-set the API key for a deployment:

```env
# .env.local
NEXT_PUBLIC_ANTHROPIC_KEY=sk-ant-...
```

Then read it in `appStore.ts` initial state: `apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_KEY || ''`

---

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel
```

The COOP/COEP headers in `next.config.ts` are required for the WebAssembly embedding model to run. These are set automatically.

### Self-hosted

```bash
npm run build
npm start
```

---

## Tech stack

- **Next.js 16** — App router, static export
- **TypeScript** — Strict mode
- **Zustand** — Global state with localStorage persistence  
- **Transformers.js** (`@xenova/transformers`) — `all-MiniLM-L6-v2` running in-browser for offline embeddings
- **idb** — IndexedDB wrapper for vector persistence
- **Anthropic Claude** (`claude-haiku-4-5-20251001`) — Generation and mind building
- **CSS custom properties** — All styling, no Tailwind in production CSS

---

## License

Private. All rights reserved.
