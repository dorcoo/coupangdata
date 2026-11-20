-- 대량 업로드 RPC에만 여유를 부여합니다. 역할과 다른 쿼리의 제한은 유지합니다.
begin;
alter function public.coupang_sales_write_metrics(jsonb, jsonb)
  set statement_timeout = '45s';
notify pgrst, 'reload schema';
commit;
