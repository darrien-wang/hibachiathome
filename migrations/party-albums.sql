-- Party album (派对相册) - 2026-11-23
-- After the party every guest can add their photos and videos through one link
-- (/album/<token>). Each person who adds at least one and leaves a name + phone
-- gets a $50 coupon for their own party. Uploading = agreeing to the album terms
-- (we may use the photos and videos on our social media and website).
-- Service-role only: RLS on, no policies.

create table if not exists public.party_albums (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders(id) on delete cascade,
  token text not null unique,
  title text not null,
  event_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  video_path text,
  video_ready_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.album_people (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.party_albums(id) on delete cascade,
  name text not null,
  phone text not null,
  device text,
  terms_version text,
  ads_ok boolean not null default false,
  created_at timestamptz not null default now(),
  unique (album_id, phone)
);

create table if not exists public.album_media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.party_albums(id) on delete cascade,
  person_id uuid references public.album_people(id) on delete set null,
  device text,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  thumb_path text,
  content_type text,
  bytes bigint,
  terms_version text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  picked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists album_media_album_idx on public.album_media (album_id, created_at);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  phone text not null,
  name text,
  amount_cents integer not null default 5000,
  source text not null,
  album_id uuid references public.party_albums(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  note text,
  unique (source, album_id, phone)
);
create index if not exists coupons_phone_idx on public.coupons (phone);

alter table public.party_albums enable row level security;
alter table public.album_people enable row level security;
alter table public.album_media enable row level security;
alter table public.coupons enable row level security;

-- 2026-11-23 (same day, owner): the page is about joining in, not the coupon.
-- Staff seed the album first (their own uploads, or the chef's shots copied in)
-- so a guest opening it sees a real album straight away.
alter table public.album_media add column if not exists source text not null default 'guest' check (source in ('guest', 'staff', 'chef'));
alter table public.album_media add column if not exists added_by text;
-- The city under the title ("Saturday, November 22 · Pasadena") - part of what
-- makes it read as a memory rather than a form. City only, never the street.
alter table public.party_albums add column if not exists place text;

-- Two links per album (owner, 2026-11-23): `token` is the invite link (whoever
-- has it can add photos), `view_token` is the share link (look and share only).
alter table public.party_albums add column if not exists view_token text unique;
update public.party_albums set view_token = substr(md5(random()::text || id::text), 1, 12) where view_token is null;
alter table public.party_albums alter column view_token set not null;

-- Names on the tiles (owner, 2026-11-23: who added each one gives people a
-- sense of "that's mine"). A guest may leave a first name after their first
-- upload - no phone, no account; one name per phone per album.
alter table public.album_people alter column phone drop not null;
create unique index if not exists album_people_album_device_uq on public.album_people (album_id, device) where device is not null;
