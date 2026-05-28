create extension if not exists pgcrypto;

create table if not exists public.daily_metrics (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  metric_date date not null,
  visitors integer not null default 0,
  views integer not null default 0,
  carts integer not null default 0,
  orders integer not null default 0,
  conversion_rate text not null default '',
  units_sold integer not null default 0,
  revenue bigint not null default 0,
  source_file text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, metric_date)
);

create table if not exists public.item_metrics (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  metric_date date not null,
  option_id text not null,
  option_name text not null default '',
  product_name text not null default '',
  registered_product_id text not null default '',
  category text not null default '',
  fulfillment text not null default '',
  revenue bigint not null default 0,
  orders integer not null default 0,
  units_sold integer not null default 0,
  visitors integer not null default 0,
  views integer not null default 0,
  carts integer not null default 0,
  conversion_rate text not null default '',
  winner_rate text not null default '',
  gross_revenue bigint not null default 0,
  gross_units integer not null default 0,
  cancel_amount bigint not null default 0,
  cancelled_units integer not null default 0,
  immediately_cancelled_units integer not null default 0,
  source_file text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, metric_date, option_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  conversation_date date not null,
  html_content text not null,
  plain_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists item_metrics_user_date_product_idx
  on public.item_metrics (user_id, metric_date, product_name);

create index if not exists conversations_user_date_idx
  on public.conversations (user_id, conversation_date desc);

alter table public.daily_metrics enable row level security;
alter table public.item_metrics enable row level security;
alter table public.conversations enable row level security;

drop policy if exists "Users manage own daily metrics" on public.daily_metrics;
create policy "Users manage own daily metrics"
  on public.daily_metrics for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own item metrics" on public.item_metrics;
create policy "Users manage own item metrics"
  on public.item_metrics for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own conversations" on public.conversations;
create policy "Users manage own conversations"
  on public.conversations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
