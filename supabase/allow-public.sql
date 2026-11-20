-- 사용자가 요청한 공개 웹 연결. 원본 테이블과 Auth 설정은 변경하지 않습니다.
begin;
do $$
begin
  if '__PRIVATE_KEY_SHA256__' !~ '^[a-f0-9]{64}$'
    or '__STANDALONE_KEY_SHA256__' !~ '^[a-f0-9]{64}$'
    or '__PUBLIC_KEY_SHA256__' !~ '^[a-f0-9]{64}$'
    or pg_catalog.to_regprocedure('public.coupang_sales_access_granted()') is null then
    raise exception '분석기 저장소와 키 해시를 먼저 확인해 주세요.';
  end if;
end $$;

create or replace function public.coupang_sales_access_granted()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    coalesce(nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb ->> 'x-coupang-sync-key', ''),
    'UTF8'
  )), 'hex') in ('__PRIVATE_KEY_SHA256__', '__STANDALONE_KEY_SHA256__', '__PUBLIC_KEY_SHA256__');
$$;

notify pgrst, 'reload schema';
commit;
