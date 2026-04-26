-- ============================================================================
-- Brooklyn Watch — initial schema
-- Multi-tenant architecture: all data is scoped by channel_id
-- ============================================================================

-- ============================================================================
-- channels: top-level entity. One row per Telegram channel.
-- ============================================================================
create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,

  telegram_chat_id text not null,
  telegram_test_chat_id text,
  test_mode boolean not null default true,

  is_enabled boolean not null default true,
  mode text not null default 'manual' check (mode in ('manual','auto','hybrid')),

  -- post template with placeholders: {type_emoji} {neighborhood_hashtag}
  -- {time_ago} {landmark} {description} {source}
  post_template text not null default
    E'{type_emoji} {neighborhood_hashtag}\n\n📍 {time_ago} · {landmark}\n\n{description}\n\n⚡ Источник: {source}',

  -- thresholds & rate limits
  min_score int not null default 30,
  min_interval_minutes int not null default 10,
  max_per_day int not null default 100,

  -- quiet hours (in America/New_York timezone)
  quiet_hours_start int,  -- hour 0-23, NULL = no quiet hours
  quiet_hours_end   int,

  -- deduplication
  dedup_radius_meters int not null default 200,
  dedup_window_hours int not null default 4,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- sources: where incidents are scraped from
-- ============================================================================
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,

  type text not null check (type in ('rss','reddit','nitter','scraper','custom')),
  name text not null,
  url text not null,
  config jsonb not null default '{}'::jsonb,

  is_enabled boolean not null default true,
  frequency_minutes int not null default 15,

  -- runtime state
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  total_fetched int not null default 0,
  total_published int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sources_channel_enabled on sources(channel_id, is_enabled);

-- ============================================================================
-- neighborhoods: districts and their hashtags
-- ============================================================================
create table if not exists neighborhoods (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,

  name text not null,
  hashtag text not null,
  parent_id uuid references neighborhoods(id) on delete set null,

  -- matching: any of these keywords in the address routes to this neighborhood
  keywords text[] not null default '{}',

  -- approximate center for geo-fallback matching
  center_lat double precision,
  center_lng double precision,
  radius_meters int default 1500,

  display_order int not null default 100,

  created_at timestamptz not null default now()
);

create index if not exists idx_neighborhoods_channel on neighborhoods(channel_id);

-- ============================================================================
-- raw_incidents: untouched data from sources, before LLM processing
-- ============================================================================
create table if not exists raw_incidents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,

  -- external_id is the source-specific unique key for dedup at fetch time
  external_id text not null,

  raw_title text,
  raw_body text,
  raw_url text,
  raw_published_at timestamptz,
  raw_data jsonb,

  fetched_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','done','rejected','error')),
  processing_error text,

  -- after processing, link to the resulting incident (may be merged with others)
  incident_id uuid,

  unique (source_id, external_id)
);

create index if not exists idx_raw_status on raw_incidents(processing_status, fetched_at);
create index if not exists idx_raw_channel on raw_incidents(channel_id);

-- ============================================================================
-- incidents: cleaned, normalized, ready-to-publish (or already published)
-- ============================================================================
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,

  raw_incident_ids uuid[] not null default '{}',

  -- classified type. Drives the emoji in posts.
  type text not null default 'other',
  -- e.g. 'shooting','robbery','fire','arrest','missing','assault','theft','crash','other'

  title_ru text not null,
  body_ru text not null,

  -- location
  address text,
  landmark text,         -- e.g. "у Key Food на 86-й"
  neighborhood_id uuid references neighborhoods(id) on delete set null,
  latitude double precision,
  longitude double precision,

  occurred_at timestamptz,
  score int not null default 50,  -- 0-100 importance/credibility

  status text not null default 'pending'
    check (status in ('pending','approved','rejected','published','merged')),

  edited_by_user boolean not null default false,
  telegram_message_id bigint,
  published_at timestamptz,

  -- when merged into another, points to the survivor
  merged_into_id uuid references incidents(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incidents_status on incidents(channel_id, status, created_at desc);
create index if not exists idx_incidents_dedup on incidents(channel_id, type, occurred_at);
create index if not exists idx_incidents_published on incidents(channel_id, published_at desc);

-- ============================================================================
-- publish_log: every Telegram post we make, for stats and rate-limiting
-- ============================================================================
create table if not exists publish_log (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  incident_id uuid references incidents(id) on delete set null,
  telegram_message_id bigint,
  published_at timestamptz not null default now(),
  is_test boolean not null default false,
  error text
);

create index if not exists idx_publish_log_channel_time on publish_log(channel_id, published_at desc);

-- ============================================================================
-- filters: stop-words, type blacklists, etc.
-- ============================================================================
create table if not exists filters (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  type text not null check (type in ('stopword','blacklist_type','required_keyword')),
  value text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_filters_channel on filters(channel_id, is_active);

-- ============================================================================
-- logs: parser/processor/publisher operational logs
-- ============================================================================
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  scope text,  -- 'parser','processor','publisher','api','cron'
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_logs_recent on logs(created_at desc);
create index if not exists idx_logs_channel on logs(channel_id, created_at desc);

-- auto-cleanup logs older than 14 days (run manually or via pg_cron)
-- delete from logs where created_at < now() - interval '14 days';

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_channels_updated on channels;
create trigger trg_channels_updated before update on channels
  for each row execute function set_updated_at();

drop trigger if exists trg_sources_updated on sources;
create trigger trg_sources_updated before update on sources
  for each row execute function set_updated_at();

drop trigger if exists trg_incidents_updated on incidents;
create trigger trg_incidents_updated before update on incidents
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS: we use service_role from the server, no public access
-- ============================================================================
alter table channels        enable row level security;
alter table sources         enable row level security;
alter table neighborhoods   enable row level security;
alter table raw_incidents   enable row level security;
alter table incidents       enable row level security;
alter table publish_log     enable row level security;
alter table filters         enable row level security;
alter table logs            enable row level security;
-- no policies = blocked for anon. Service role bypasses RLS by design.
