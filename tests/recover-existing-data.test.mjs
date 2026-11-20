import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const install = fs.readFileSync(new URL("../supabase/shared-project.sql", import.meta.url), "utf8")
  .replaceAll("__WORKSPACE_KEY_SHA256__", createHash("sha256").update("a".repeat(64)).digest("hex"));
const recovery = fs.readFileSync(new URL("../supabase/recover-existing-data.sql", import.meta.url), "utf8")
  .replaceAll("__EXISTING_USER_UUID__", owner);

test("account recovery copies every metric, excludes other accounts, and preserves originals", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);");
    await db.query("insert into auth.users values ($1), ($2)", [owner, other]);
    await db.exec(install);
    await db.exec(`
      create table public.daily_metrics as select '${owner}'::uuid as user_id, d.*, now() as created_at
        from public.coupang_sales_daily_metrics d with no data;
      create table public.item_metrics as select '${owner}'::uuid as user_id, i.*, now() as created_at
        from public.coupang_sales_item_metrics i with no data;
    `);
    for (const [user, revenue] of [[owner, 12345], [other, 98765]]) {
      await db.query(`insert into public.daily_metrics values ($1, '2026-10-04', 1, 2, 3, 4, '12%', 5, $2, 'summary.xlsx', now())`, [user, revenue]);
      await db.query(`insert into public.item_metrics values ($1, '2026-10-04', 'option-1', '옵션', '상품', 'product-1', '분류', '판매자배송', $2, 4, 5, 1, 2, 3, '12%', '98%', 13000, 6, -655, -1, -1, 'item.xlsx', now())`, [user, revenue]);
    }
    const originals = await db.query("select to_jsonb(d) as row from public.daily_metrics d union all select to_jsonb(i) from public.item_metrics i");
    const acl = await db.query("select relname, relacl::text, relrowsecurity from pg_class where oid in ('public.daily_metrics'::regclass,'public.item_metrics'::regclass) order by relname");
    await db.exec(`begin; ${recovery} commit;`);
    for (const table of ["daily_metrics", "item_metrics"]) {
      const copied = (await db.query(`select to_jsonb(d) as row from public.coupang_sales_${table} d`)).rows;
      const expected = (await db.query(`select to_jsonb(d) - 'user_id' - 'created_at' as row from public.${table} d where user_id=$1`, [owner])).rows;
      assert.deepEqual(copied, expected);
    }
    assert.deepEqual((await db.query("select to_jsonb(d) as row from public.daily_metrics d union all select to_jsonb(i) from public.item_metrics i")).rows, originals.rows);
    assert.deepEqual((await db.query("select relname, relacl::text, relrowsecurity from pg_class where oid in ('public.daily_metrics'::regclass,'public.item_metrics'::regclass) order by relname")).rows, acl.rows);
    await assert.rejects(db.exec(`begin; ${recovery} commit;`), /새 저장소에 자료/);
    await db.exec("rollback;");
    await db.exec("truncate public.coupang_sales_daily_metrics, public.coupang_sales_item_metrics;");
    await assert.rejects(db.exec(`begin; ${recovery.replaceAll(owner, "33333333-3333-4333-8333-333333333333")} commit;`), /복구 대상 계정/);
    await db.exec("rollback;");
    assert.equal((await db.query("select count(*)::int as n from public.daily_metrics")).rows[0].n, 2);
  } finally { await db.close(); }
});
