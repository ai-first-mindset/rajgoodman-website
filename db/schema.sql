-- Blog posts schema for the rajgoodman.com editor (Supabase / Postgres).
-- Run in the Supabase SQL editor. service_role (used by our serverless functions)
-- bypasses RLS; anon is restricted to published rows only.

create table if not exists posts (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  title               text not null,                 -- on-page H1
  seo_title           text,                          -- <title>; falls back to title
  meta_description    text,
  excerpt             text,
  body_html           text,                          -- sanitised HTML body
  featured_image      text,                          -- og:image URL
  featured_image_alt  text,
  author              text not null default 'Raj Goodman Anand',
  canonical_url       text,                          -- override; defaults to self
  robots              text not null default 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  focus_keyphrase     text,                          -- editorial only, never rendered
  og_title            text,                          -- social override; falls back to seo_title/title
  og_description      text,                          -- social override; falls back to meta_description/excerpt
  og_image            text,                          -- social override; falls back to featured_image
  prev_slugs          text[] not null default '{}',  -- former slugs → 301 redirect to current
  categories          text[] not null default '{}',  -- display names; archive at /blog/category/{slug}/
  status              text not null default 'draft' check (status in ('draft','published')),
  published_at        timestamptz,                   -- set once on first publish
  modified_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- Additive migrations (safe to re-run on an existing table).
alter table posts add column if not exists og_title text;
alter table posts add column if not exists og_description text;
alter table posts add column if not exists og_image text;
alter table posts add column if not exists prev_slugs text[] not null default '{}';
alter table posts add column if not exists categories text[] not null default '{}';

create index if not exists posts_status_pub_idx on posts (status, published_at desc);
create unique index if not exists posts_slug_idx on posts (slug);
create index if not exists posts_prev_slugs_idx on posts using gin (prev_slugs);
create index if not exists posts_categories_idx on posts using gin (categories);

-- Storage bucket for blog image uploads (public read; service role writes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-media', 'blog-media', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do nothing;

-- Media library metadata: an optional overlay keyed by the storage object path.
-- The bucket is the source of truth for which files exist; this table only adds
-- alt/caption/title. Files with no row here simply have empty metadata.
create table if not exists media (
  path        text primary key,   -- storage object path within blog-media
  alt         text,
  caption     text,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Admin-managed only; functions use service_role (bypasses RLS). No anon access.
alter table media enable row level security;

-- LinkedIn posts shown in the homepage "On LinkedIn" widget. Managed in the
-- admin (top-level "LinkedIn"); the public /api/linkedin returns the first 4
-- visible rows by sort_order. Functions use service_role; no anon access.
create table if not exists linkedin_posts (
  id          uuid primary key default gen_random_uuid(),
  url         text unique not null,
  title       text,
  image_url   text,                          -- thumbnail (Media Library / asset path)
  visible     boolean not null default true, -- show in the homepage widget
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists linkedin_posts_order_idx on linkedin_posts (visible, sort_order);
alter table linkedin_posts enable row level security;

-- Seed with the four cards currently hard-coded in index.html (idempotent).
insert into linkedin_posts (url, title, image_url, sort_order) values
  ('https://www.linkedin.com/posts/rajanand_5-people-who-prove-you-need-an-ai-readiness-activity-7377326083894886400-HLlS/', '5 People Who Prove You Need an AI Readiness Assessment', '/assets/1748005613860.webp', 1),
  ('https://www.linkedin.com/posts/rajanand_aitalentshortage-aitalent-fractionalcaio-activity-7379500493443751936-W4ua/', 'The AI talent shortage and the fractional CAIO', '/assets/1748305267974.webp', 2),
  ('https://www.linkedin.com/posts/rajanand_inside-autonomous-ai-how-decisions-happen-activity-7382399516739735552-BDzn/', 'Inside autonomous AI: how decisions happen', '/assets/1748610490704.webp', 3),
  ('https://www.linkedin.com/posts/rajanand_your-ai-strategy-changes-with-your-location-activity-7381312426392084480-2NYd/', 'Your AI strategy changes with your location', '/assets/1748886274361.webp', 4)
on conflict (url) do nothing;

-- keep modified_at fresh on every update
create or replace function set_modified_at() returns trigger as $$
begin new.modified_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists posts_set_modified on posts;
create trigger posts_set_modified before update on posts
  for each row execute function set_modified_at();

-- RLS: functions use service_role (bypasses). Public/anon may read published only.
alter table posts enable row level security;
drop policy if exists posts_public_read on posts;
create policy posts_public_read on posts for select
  using (status = 'published');
