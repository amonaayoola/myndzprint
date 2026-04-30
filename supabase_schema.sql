-- ============================================================
-- Myndzprint: pgvector schema for production RAG hosting
-- Run this in Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Minds table (public minds shared across all users)
create table if not exists minds (
  id           text primary key,
  name         text not null,
  era          text,
  type         text,
  domain       text,
  quote        text,
  opening      text,
  tags         text[],
  system       text,
  corpus       text,
  voice_style  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 3. Vector chunks table — one row per chunk, with label columns for TagRAG
create table if not exists mind_chunks (
  id              text primary key,
  mind_id         text not null references minds(id) on delete cascade,
  text            text not null,
  embedding       vector(384),        -- all-MiniLM-L6-v2 dimension
  topic_label     text not null default 'general',
  register_label  text not null default 'balanced',
  source_type     text not null default 'corpus',  -- 'corpus' | 'brain'
  created_at      timestamptz default now()
);

-- 4. Indexes for fast filtered retrieval (TagRAG two-pass)
create index if not exists idx_chunks_mind_id
  on mind_chunks(mind_id);

create index if not exists idx_chunks_topic
  on mind_chunks(mind_id, topic_label);

create index if not exists idx_chunks_source
  on mind_chunks(mind_id, source_type);

-- 5. pgvector HNSW index for approximate nearest neighbor search
--    Only kicks in when doing full-table similarity scans.
--    Filtered queries (WHERE mind_id = x AND topic_label = y) use the
--    B-tree indexes above first, then cosine similarity on the filtered set.
create index if not exists idx_chunks_embedding
  on mind_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 6. User-built minds (private, per user)
create table if not exists user_minds (
  id           text not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  era          text,
  type         text,
  domain       text,
  quote        text,
  opening      text,
  tags         text[],
  system       text,
  corpus       text,
  voice_style  text,
  brain        jsonb,                -- serialized brain entries
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (id, user_id)
);

create table if not exists user_mind_chunks (
  id              text not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  mind_id         text not null,
  text            text not null,
  embedding       vector(384),
  topic_label     text not null default 'general',
  register_label  text not null default 'balanced',
  source_type     text not null default 'corpus',
  created_at      timestamptz default now(),
  primary key (id, user_id)
);

create index if not exists idx_user_chunks_mind
  on user_mind_chunks(user_id, mind_id);

create index if not exists idx_user_chunks_topic
  on user_mind_chunks(user_id, mind_id, topic_label);

create index if not exists idx_user_chunks_embedding
  on user_mind_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 7. Row-level security
alter table minds           enable row level security;
alter table mind_chunks     enable row level security;
alter table user_minds      enable row level security;
alter table user_mind_chunks enable row level security;

-- Public minds: anyone can read, only service role can write
create policy "public minds readable by all"
  on minds for select using (true);

create policy "public chunks readable by all"
  on mind_chunks for select using (true);

-- User minds: users can only see and write their own
create policy "users manage own minds"
  on user_minds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own chunks"
  on user_mind_chunks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 8. TagRAG similarity search function (server-side, called from /api/rag)
--    Filters by mind + optional topic label, then does cosine similarity.
create or replace function match_chunks(
  p_mind_id      text,
  p_embedding    vector(384),
  p_match_count  int     default 5,
  p_min_score    float   default 0.2,
  p_topic_label  text    default null,
  p_source_type  text    default null
)
returns table (
  id             text,
  text           text,
  topic_label    text,
  register_label text,
  source_type    text,
  similarity     float
)
language sql stable
as $$
  select
    c.id,
    c.text,
    c.topic_label,
    c.register_label,
    c.source_type,
    1 - (c.embedding <=> p_embedding) as similarity
  from mind_chunks c
  where c.mind_id = p_mind_id
    and (p_topic_label is null or c.topic_label = p_topic_label)
    and (p_source_type is null or c.source_type = p_source_type)
    and 1 - (c.embedding <=> p_embedding) > p_min_score
  order by c.embedding <=> p_embedding
  limit p_match_count;
$$;

-- Same for user chunks
create or replace function match_user_chunks(
  p_user_id      uuid,
  p_mind_id      text,
  p_embedding    vector(384),
  p_match_count  int     default 5,
  p_min_score    float   default 0.2,
  p_topic_label  text    default null
)
returns table (
  id             text,
  text           text,
  topic_label    text,
  register_label text,
  source_type    text,
  similarity     float
)
language sql stable
as $$
  select
    c.id,
    c.text,
    c.topic_label,
    c.register_label,
    c.source_type,
    1 - (c.embedding <=> p_embedding) as similarity
  from user_mind_chunks c
  where c.user_id = p_user_id
    and c.mind_id = p_mind_id
    and (p_topic_label is null or c.topic_label = p_topic_label)
    and 1 - (c.embedding <=> p_embedding) > p_min_score
  order by c.embedding <=> p_embedding
  limit p_match_count;
$$;
