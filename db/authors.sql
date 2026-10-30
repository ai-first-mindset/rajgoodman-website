-- Author profiles (Deth's blog requirements, Nov 2026; mirrors aifirstmindset.ai). A post still stores the
-- author's display name in posts.author; this table supplies the reusable
-- profile (title, bio, photo, LinkedIn) looked up by that name, so a bio is
-- written once instead of on every post. Service role only, like posts.

create table if not exists authors (
  slug          text primary key,
  name          text unique not null,
  title         text,
  bio           text,
  image_url     text,
  linkedin_url  text,
  sort          int not null default 100,
  created_at    timestamptz not null default now(),
  modified_at   timestamptz not null default now()
);

alter table authors enable row level security;

-- Seed: Deth's doc says rajgoodman.com uses the same profile as aifirstmindset.ai.
insert into authors (slug, name, title, bio, image_url, linkedin_url, sort) values
('raj-goodman-anand', 'Raj Goodman Anand', 'AI Futurist, Keynote Speaker & Founder',
 'Raj Goodman Anand is the Founder and Director of AI-First Mindset®, where he helps business leaders move from AI curiosity to real operational impact. Known for his domain expertise, Raj is a sought-after speaker in marketing and tech, and his AI workshops for business leaders are globally well recognized. He combines an engineering background with a practical, outcomes-led approach focused on embedding AI inside real processes and workflows beyond theory. Through coaching and expert-led programmes, Raj is on a mission to educate one million people to use AI to increase the quality of their lives through better efficiency and high growth.',
 'https://djpxdnxnvuokdfxlwktx.supabase.co/storage/v1/object/public/blog-media/wp-content/uploads/2024/06/raj-1.webp',
 'https://www.linkedin.com/in/rajanand/', 10)
on conflict (slug) do nothing;
