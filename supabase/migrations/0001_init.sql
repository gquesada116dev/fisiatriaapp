-- ============================================================
-- FisiaPrep schema
-- Single-user app, but we still scope rows by a `user_id` text
-- column (always 'her') so future expansion is trivial.
-- ============================================================

-- Enable extensions
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- topics: hierarchical via `category` text; seeded once.
-- ----------------------------------------------------------
create table if not exists topics (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  name        text not null,
  slug        text not null unique,
  description text,
  priority    smallint not null default 3 check (priority between 1 and 5),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists topics_category_idx on topics (category, sort_order);

-- ----------------------------------------------------------
-- summaries: one cached AI-generated summary per topic.
-- Regenerate only when explicitly invalidated.
-- ----------------------------------------------------------
create table if not exists summaries (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references topics(id) on delete cascade,
  -- Structured markdown content. We render this on the topic page.
  content_md  text not null,
  -- Optional: store sections separately for richer rendering.
  sections    jsonb,
  model       text not null,                  -- which Claude model generated it
  prompt_v    smallint not null default 1,    -- bump when we change the prompt
  created_at  timestamptz not null default now(),
  unique (topic_id)
);

-- ----------------------------------------------------------
-- questions: MCQ pool per topic. Generated in batches and reused.
-- ----------------------------------------------------------
create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid not null references topics(id) on delete cascade,
  stem          text not null,
  -- options is jsonb array of { letter: 'A'|'B'|'C'|'D'|'E', text: '...' }
  options       jsonb not null,
  correct       text not null,                -- letter, e.g. 'C'
  explanation   text not null,
  difficulty    smallint not null default 3 check (difficulty between 1 and 5),
  model         text not null,
  prompt_v      smallint not null default 1,
  created_at    timestamptz not null default now()
);
create index if not exists questions_topic_idx on questions (topic_id);

-- ----------------------------------------------------------
-- question_attempts: every answer she gives.
-- ----------------------------------------------------------
create table if not exists question_attempts (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references questions(id) on delete cascade,
  topic_id      uuid not null references topics(id) on delete cascade,
  chosen        text not null,                -- letter she picked
  correct       boolean not null,
  time_ms       integer,                      -- optional: time to answer
  created_at    timestamptz not null default now()
);
create index if not exists qa_topic_created_idx on question_attempts (topic_id, created_at desc);

-- ----------------------------------------------------------
-- flashcards: front/back cards per topic. Generated once.
-- ----------------------------------------------------------
create table if not exists flashcards (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references topics(id) on delete cascade,
  front       text not null,
  back        text not null,
  tags        text[] default '{}',
  model       text not null,
  prompt_v    smallint not null default 1,
  created_at  timestamptz not null default now()
);
create index if not exists flashcards_topic_idx on flashcards (topic_id);

-- ----------------------------------------------------------
-- flashcard_reviews: SM-2 state per card.
-- One row per (card) — we update in place after each review.
-- We also append to flashcard_review_log for history/analytics.
-- ----------------------------------------------------------
create table if not exists flashcard_reviews (
  flashcard_id    uuid primary key references flashcards(id) on delete cascade,
  repetitions     integer not null default 0,       -- SM-2: n
  ease_factor     real    not null default 2.5,     -- SM-2: EF, min 1.3
  interval_days   integer not null default 0,       -- SM-2: I
  due_at          timestamptz not null default now(),
  last_reviewed   timestamptz,
  last_quality    smallint                          -- 0..5 grading
);
create index if not exists fr_due_idx on flashcard_reviews (due_at);

create table if not exists flashcard_review_log (
  id            uuid primary key default gen_random_uuid(),
  flashcard_id  uuid not null references flashcards(id) on delete cascade,
  quality       smallint not null check (quality between 0 and 5),
  prev_interval integer,
  next_interval integer,
  reviewed_at   timestamptz not null default now()
);
create index if not exists frl_card_idx on flashcard_review_log (flashcard_id, reviewed_at desc);

-- ----------------------------------------------------------
-- podcasts: one cached audio per topic.
-- We store the script + the storage path to the audio file.
-- NEVER regenerated on playback.
-- ----------------------------------------------------------
create table if not exists podcasts (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references topics(id) on delete cascade,
  -- script is jsonb: [{ speaker: 'A'|'B', text: '...' }, ...]
  script      jsonb not null,
  -- storage path within the 'podcasts' Supabase Storage bucket
  audio_path  text not null,
  duration_s  integer,                        -- best-effort duration in seconds
  voice_a     text not null,                  -- ElevenLabs voice id used
  voice_b     text not null,
  model       text not null,                  -- Claude model for script
  prompt_v    smallint not null default 1,
  created_at  timestamptz not null default now(),
  unique (topic_id)
);

-- ----------------------------------------------------------
-- Derived view: topic_progress
-- Combines flashcard mastery and MCQ accuracy into a single score.
-- ----------------------------------------------------------
create or replace view topic_progress as
with mcq as (
  select
    topic_id,
    count(*)                                          as attempts,
    sum(case when correct then 1 else 0 end)::float
      / nullif(count(*), 0)                           as accuracy
  from question_attempts
  group by topic_id
),
cards as (
  select
    f.topic_id,
    count(*)                                          as total_cards,
    count(fr.flashcard_id)                            as reviewed_cards,
    avg(coalesce(fr.ease_factor, 2.5))                as avg_ef,
    sum(case when fr.interval_days >= 21 then 1 else 0 end) as mature_cards
  from flashcards f
  left join flashcard_reviews fr on fr.flashcard_id = f.id
  group by f.topic_id
)
select
  t.id          as topic_id,
  t.slug,
  t.name,
  coalesce(c.total_cards, 0)                                       as total_cards,
  coalesce(c.mature_cards, 0)                                      as mature_cards,
  coalesce(m.attempts, 0)                                          as mcq_attempts,
  coalesce(m.accuracy, 0)                                          as mcq_accuracy,
  -- Mastery: 60% weight on mature flashcards %, 40% on MCQ accuracy (min 5 attempts).
  -- If no data at all, mastery is 0.
  least(
    1.0,
    0.6 * (coalesce(c.mature_cards, 0)::float / nullif(c.total_cards, 0))
    + 0.4 * case when coalesce(m.attempts, 0) >= 5 then coalesce(m.accuracy, 0) else 0 end
  ) as mastery
from topics t
left join cards c on c.topic_id = t.id
left join mcq   m on m.topic_id = t.id;

-- ----------------------------------------------------------
-- Storage bucket for podcasts (run once via Supabase dashboard
-- if SQL doesn't suffice in your project).
-- ----------------------------------------------------------
-- Equivalent dashboard step: create a public bucket named 'podcasts'.
-- Or via SQL:
insert into storage.buckets (id, name, public)
values ('podcasts', 'podcasts', true)
on conflict (id) do nothing;
