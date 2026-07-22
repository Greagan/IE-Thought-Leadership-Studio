-- Imprint Engine Thought Leadership Studio — phase 2 schema (Neon Postgres)
-- Run once against your Neon database (see SETUP-PHASE2.md).

create table if not exists profiles (
  id          text primary key,
  name        text not null,
  role        text default '',
  topics      text default '',
  notes       text default '',
  sample      text default '',
  created_by  text,
  updated_at  timestamptz not null default now()
);

create table if not exists drafts (
  id            text primary key,
  author_email  text not null,
  author_name   text default '',
  type          text default 'linkedin',
  profile_id    text,
  body          text not null,
  visual        text default '',
  -- status: draft | in_review | approved | changes_requested
  status        text not null default 'draft',
  reviewer_email text,
  review_note   text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists drafts_status_idx on drafts(status);
create index if not exists drafts_author_idx on drafts(author_email);

-- One row per content type controlling how it is reviewed: 'self' or 'approver'
create table if not exists review_settings (
  content_type text primary key,
  mode         text not null default 'self'
);

create table if not exists approvers (
  email     text primary key,
  added_by  text,
  added_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  actor_email text,
  action      text,        -- generated | saved | submitted | approved | changes_requested | self_reviewed | profile_saved | profile_deleted
  entity      text,        -- draft id or profile id
  detail      text default ''
);

-- Sensible defaults: everything self-review until an approver turns on the queue.
insert into review_settings (content_type, mode) values
  ('linkedin','self'),('comment','self'),('repurpose','self'),('hottake','self'),
  ('transcript','self'),('videoscript','self'),('longform','self'),('newsletter','self')
on conflict (content_type) do nothing;
