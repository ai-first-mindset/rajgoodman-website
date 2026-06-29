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

create index if not exists posts_status_pub_idx on posts (status, published_at desc);
create unique index if not exists posts_slug_idx on posts (slug);
create index if not exists posts_prev_slugs_idx on posts using gin (prev_slugs);

-- Storage bucket for blog image uploads (public read; service role writes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-media', 'blog-media', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do nothing;

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
