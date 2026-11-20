-- 기존 계정 자료를 새 분석기 저장소에 복사합니다. 원본 테이블은 변경하지 않습니다.
-- __EXISTING_USER_UUID__를 확인한 계정 UUID로 바꾸고, 최초 설치 트랜잭션 안에서 실행합니다.
do $$
begin
  if not exists (select 1 from auth.users where id = '__EXISTING_USER_UUID__'::uuid) then
    raise exception '복구 대상 계정이 없습니다.';
  end if;
  if exists (select 1 from public.coupang_sales_daily_metrics)
    or exists (select 1 from public.coupang_sales_item_metrics) then
    raise exception '새 저장소에 자료가 있어 복구를 중지합니다.';
  end if;
end $$;

insert into public.coupang_sales_daily_metrics (
  metric_date, visitors, views, carts, orders, conversion_rate, units_sold, revenue, source_file
)
select metric_date, visitors, views, carts, orders, conversion_rate, units_sold, revenue, source_file
from public.daily_metrics where user_id = '__EXISTING_USER_UUID__'::uuid;

insert into public.coupang_sales_item_metrics (
  metric_date, option_id, option_name, product_name, registered_product_id, category, fulfillment,
  revenue, orders, units_sold, visitors, views, carts, conversion_rate, winner_rate,
  gross_revenue, gross_units, cancel_amount, cancelled_units, immediately_cancelled_units, source_file
)
select metric_date, option_id, option_name, product_name, registered_product_id, category, fulfillment,
  revenue, orders, units_sold, visitors, views, carts, conversion_rate, winner_rate,
  gross_revenue, gross_units, cancel_amount, cancelled_units, immediately_cancelled_units, source_file
from public.item_metrics where user_id = '__EXISTING_USER_UUID__'::uuid;

do $$
begin
  if (select count(*) from public.coupang_sales_daily_metrics)
      <> (select count(*) from public.daily_metrics where user_id = '__EXISTING_USER_UUID__'::uuid)
    or (select count(*) from public.coupang_sales_item_metrics)
      <> (select count(*) from public.item_metrics where user_id = '__EXISTING_USER_UUID__'::uuid) then
    raise exception '원본과 복구된 자료 건수가 일치하지 않습니다.';
  end if;
end $$;
