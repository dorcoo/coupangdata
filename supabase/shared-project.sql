-- 분석기 전용 설치. 실행할 Supabase 프로젝트를 확인하세요.
-- 기존 앱의 테이블, 정책, 인증 설정은 변경하지 않습니다.
-- scripts/prepare-cloud-connection.mjs로 접근 키 해시가 채워진 SQL을 생성하세요.
begin;

do $$
begin
  if '__WORKSPACE_KEY_SHA256__' !~ '^[a-f0-9]{64}$' then
    raise exception '먼저 연결 파일과 실행용 SQL을 생성해 주세요.';
  end if;
  if pg_catalog.to_regclass('public.coupang_sales_daily_metrics') is not null
    or pg_catalog.to_regclass('public.coupang_sales_item_metrics') is not null
    or pg_catalog.to_regprocedure('public.coupang_sales_access_granted()') is not null
    or pg_catalog.to_regprocedure('public.coupang_sales_read_snapshot()') is not null
    or pg_catalog.to_regprocedure('public.coupang_sales_read_page(integer,date,text,boolean)') is not null
    or pg_catalog.to_regprocedure('public.coupang_sales_write_metrics(jsonb,jsonb)') is not null
    or pg_catalog.to_regprocedure('public.coupang_sales_clear_metrics()') is not null then
    raise exception '분석기 이름과 겹치는 기존 객체가 있어 설치를 중지합니다. 기존 객체를 먼저 확인해 주세요.';
  end if;
end $$;

create table public.coupang_sales_daily_metrics (
  metric_date date primary key,
  visitors integer not null default 0,
  views integer not null default 0,
  carts integer not null default 0,
  orders integer not null default 0,
  conversion_rate text not null default '',
  units_sold integer not null default 0,
  revenue bigint not null default 0,
  source_file text not null
);

create table public.coupang_sales_item_metrics (
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
  primary key (metric_date, option_id)
);

create function public.coupang_sales_access_granted()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    coalesce(nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb ->> 'x-coupang-sync-key', ''),
    'UTF8'
  )), 'hex') = '__WORKSPACE_KEY_SHA256__';
$$;

alter table public.coupang_sales_daily_metrics enable row level security;
alter table public.coupang_sales_item_metrics enable row level security;

create policy coupang_sales_daily_access on public.coupang_sales_daily_metrics
for all to anon, authenticated
using ((select public.coupang_sales_access_granted()))
with check ((select public.coupang_sales_access_granted()));

create policy coupang_sales_items_access on public.coupang_sales_item_metrics
for all to anon, authenticated
using ((select public.coupang_sales_access_granted()))
with check ((select public.coupang_sales_access_granted()));

grant select, insert, update, delete
on public.coupang_sales_daily_metrics, public.coupang_sales_item_metrics to anon, authenticated;

create function public.coupang_sales_read_snapshot()
returns json
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.coupang_sales_access_granted() then
    raise exception 'Invalid connection key' using errcode = '42501';
  end if;
  return pg_catalog.json_build_object(
    'daily', (select coalesce(pg_catalog.json_agg(d order by d.metric_date), '[]'::json)
      from public.coupang_sales_daily_metrics d),
    'items', (select coalesce(pg_catalog.json_agg(i order by i.metric_date, i.option_id), '[]'::json)
      from public.coupang_sales_item_metrics i)
  );
end;
$$;

-- 큰 자료도 각 요청의 실행 시간과 메모리를 제한하며 읽습니다.
create function public.coupang_sales_read_page(
  page_size integer default 5000, after_date date default null,
  after_option_id text default null, include_daily boolean default true
)
returns json
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.coupang_sales_access_granted() then
    raise exception 'Invalid connection key' using errcode = '42501';
  end if;
  if page_size is null or page_size < 1 or page_size > 5000
    or (after_date is null) <> (after_option_id is null) then
    raise exception 'Invalid page cursor or size' using errcode = '22023';
  end if;
  return pg_catalog.json_build_object(
    'daily', case when include_daily then
      (select coalesce(pg_catalog.json_agg(d order by d.metric_date), '[]'::json)
        from public.coupang_sales_daily_metrics d) else '[]'::json end,
    'items', (select coalesce(pg_catalog.json_agg(i), '[]'::json) from (
      select m.* from public.coupang_sales_item_metrics m
      where after_date is null or (m.metric_date, m.option_id) > (after_date, after_option_id)
      order by m.metric_date, m.option_id limit page_size
    ) i)
  );
end;
$$;

create function public.coupang_sales_write_metrics(daily_rows jsonb default '[]'::jsonb, item_rows jsonb default '[]'::jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  daily_count integer;
  item_count integer;
begin
  if not public.coupang_sales_access_granted() then
    raise exception 'Invalid connection key' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(daily_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(item_rows) is distinct from 'array' then
    raise exception 'Metrics must be arrays' using errcode = '22023';
  end if;

  insert into public.coupang_sales_daily_metrics
  select distinct on (r.metric_date) r.*
  from pg_catalog.jsonb_array_elements(daily_rows) with ordinality as entry(value, position)
  cross join lateral pg_catalog.jsonb_populate_record(null::public.coupang_sales_daily_metrics, entry.value) as r
  order by r.metric_date, entry.position desc
  on conflict (metric_date) do update set
    visitors = excluded.visitors, views = excluded.views, carts = excluded.carts,
    orders = excluded.orders, conversion_rate = excluded.conversion_rate,
    units_sold = excluded.units_sold, revenue = excluded.revenue, source_file = excluded.source_file;
  get diagnostics daily_count = row_count;

  insert into public.coupang_sales_item_metrics
  select distinct on (r.metric_date, r.option_id) r.*
  from pg_catalog.jsonb_array_elements(item_rows) with ordinality as entry(value, position)
  cross join lateral pg_catalog.jsonb_populate_record(null::public.coupang_sales_item_metrics, entry.value) as r
  order by r.metric_date, r.option_id, entry.position desc
  on conflict (metric_date, option_id) do update set
    option_name = excluded.option_name, product_name = excluded.product_name,
    registered_product_id = excluded.registered_product_id, category = excluded.category,
    fulfillment = excluded.fulfillment, revenue = excluded.revenue, orders = excluded.orders,
    units_sold = excluded.units_sold, visitors = excluded.visitors, views = excluded.views,
    carts = excluded.carts, conversion_rate = excluded.conversion_rate,
    winner_rate = excluded.winner_rate, gross_revenue = excluded.gross_revenue,
    gross_units = excluded.gross_units, cancel_amount = excluded.cancel_amount,
    cancelled_units = excluded.cancelled_units, immediately_cancelled_units = excluded.immediately_cancelled_units,
    source_file = excluded.source_file;
  get diagnostics item_count = row_count;

  return pg_catalog.jsonb_build_object('daily', daily_count, 'items', item_count);
end;
$$;

create function public.coupang_sales_clear_metrics()
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare daily_count integer; item_count integer;
begin
  if not public.coupang_sales_access_granted() then
    raise exception 'Invalid connection key' using errcode = '42501';
  end if;
  delete from public.coupang_sales_daily_metrics;
  get diagnostics daily_count = row_count;
  delete from public.coupang_sales_item_metrics;
  get diagnostics item_count = row_count;
  return pg_catalog.jsonb_build_object('daily', daily_count, 'items', item_count);
end;
$$;

revoke all on function public.coupang_sales_access_granted() from public;
revoke all on function public.coupang_sales_read_snapshot() from public;
revoke all on function public.coupang_sales_read_page(integer, date, text, boolean) from public;
revoke all on function public.coupang_sales_write_metrics(jsonb, jsonb) from public;
revoke all on function public.coupang_sales_clear_metrics() from public;
grant execute on function public.coupang_sales_access_granted() to anon, authenticated;
grant execute on function public.coupang_sales_read_snapshot() to anon, authenticated;
grant execute on function public.coupang_sales_read_page(integer, date, text, boolean) to anon, authenticated;
grant execute on function public.coupang_sales_write_metrics(jsonb, jsonb) to anon, authenticated;
grant execute on function public.coupang_sales_clear_metrics() to anon, authenticated;

notify pgrst, 'reload schema';
commit;
