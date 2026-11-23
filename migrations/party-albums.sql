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
