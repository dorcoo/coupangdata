import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const key = "a".repeat(64);
const hash = createHash("sha256").update(key).digest("hex");
const sql = fs.readFileSync(new URL("../supabase/shared-project.sql", import.meta.url), "utf8")
  .replaceAll("__WORKSPACE_KEY_SHA256__", hash);
const daily = { metric_date: "2026-11-15", visitors: 1, views: 10, carts: 1, orders: 1,
  conversion_rate: "10%", units_sold: 1, revenue: 100, source_file: "daily.xlsx" };
const item = { ...daily, option_id: "option-1", option_name: "test", product_name: "test",
  registered_product_id: "product-1", category: "test", fulfillment: "판매자배송", winner_rate: "100",
  gross_revenue: 100, gross_units: 1, cancel_amount: 0, cancelled_units: 0, immediately_cancelled_units: 0 };
let db;
let originalApp;

const configureHeaders = async (accessKey) => db.query("select set_config('request.headers', $1, false)", [JSON.stringify(accessKey ? { "x-coupang-sync-key": accessKey } : {})]);
const write = (dailyRows = [], items = []) => db.query("select public.coupang_sales_write_metrics($1::jsonb, $2::jsonb) as counts", [JSON.stringify(dailyRows), JSON.stringify(items)]);
const snapshot = async () => (await db.query("select public.coupang_sales_read_snapshot() as snapshot")).rows[0].snapshot;
const denied = (error) => error.code === "42501";

before(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create table public.other_app_records (id integer primary key, value text); insert into public.other_app_records values (1, 'keep'); grant select on public.other_app_records to authenticated; alter table public.other_app_records enable row level security;");
  originalApp = (await db.query("select relacl::text, relrowsecurity from pg_class where oid = 'public.other_app_records'::regclass")).rows;
  await db.exec(sql);
});
beforeEach(async () => {
  await db.exec("reset role; truncate public.coupang_sales_daily_metrics, public.coupang_sales_item_metrics; set role anon;");
  await configureHeaders(null);
});
after(async () => { await db?.close(); });

test("public key access alone cannot read, insert, or delete analytics", async () => {
  assert.equal((await db.query("select public.coupang_sales_access_granted() as allowed")).rows[0].allowed, false);
  await assert.rejects(snapshot(), denied);
  await assert.rejects(db.query("select public.coupang_sales_read_page()"), denied);
  await assert.rejects(write([daily], [item]), denied);
  await assert.rejects(db.query("select public.coupang_sales_clear_metrics()"), denied);
  assert.deepEqual((await db.query("select * from public.coupang_sales_item_metrics")).rows, []);
});

test("connection key allows authenticated and anonymous roles without changing Auth settings", async () => {
  await configureHeaders(key);
  assert.deepEqual((await write([daily], [item])).rows[0].counts, { daily: 1, items: 1 });
  assert.deepEqual(await snapshot(), { daily: [daily], items: [item] });
  await db.exec("set role authenticated;");
  assert.equal((await snapshot()).items.length, 1);
  await configureHeaders("b".repeat(64));
  await assert.rejects(snapshot(), denied);
  assert.deepEqual((await db.query("delete from public.coupang_sales_item_metrics returning *")).rows, []);
  await configureHeaders(key);
  assert.equal((await snapshot()).items.length, 1);
});

test("failed item validation rolls back daily metrics in the same import", async () => {
  await configureHeaders(key);
  await assert.rejects(write([daily], [{ ...item, option_id: null }]));
  assert.deepEqual(await snapshot(), { daily: [], items: [] });
});

test("duplicate rows in an import use the last occurrence without double-counting", async () => {
  await configureHeaders(key);
  await write([daily, { ...daily, revenue: 200 }], [item, { ...item, revenue: 300 }]);
  const result = await snapshot();
  assert.equal(result.daily.length, 1);
  assert.equal(result.daily[0].revenue, 200);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].revenue, 300);
});

test("snapshot returns more than 1000 items in one scalar RPC response", async () => {
  await configureHeaders(key);
  await write([], Array.from({ length: 1201 }, (_, index) => ({ ...item, option_id: String(index).padStart(4, "0") })));
  assert.equal((await snapshot()).items.length, 1201);
});

test("bounded page reads preserve same-date options and include daily metrics only when requested", async () => {
  await configureHeaders(key);
  await write([daily], Array.from({ length: 1201 }, (_, index) => ({ ...item, option_id: String(index).padStart(4, "0") })));
  const first = (await db.query("select public.coupang_sales_read_page(1000) as page")).rows[0].page;
  assert.deepEqual(first.daily, [daily]);
  assert.equal(first.items.length, 1000);
  const last = first.items.at(-1);
  const second = (await db.query("select public.coupang_sales_read_page(1000, $1::date, $2, false) as page", [last.metric_date, last.option_id])).rows[0].page;
  assert.deepEqual(second.daily, []);
  assert.equal(second.items.length, 201);
  assert.equal(new Set([...first.items, ...second.items].map(r => r.option_id)).size, 1201);
  await assert.rejects(db.query("select public.coupang_sales_read_page(5001)"), e => e.code === "22023");
  await assert.rejects(db.query("select public.coupang_sales_read_page(1000, '2026-11-15')"), e => e.code === "22023");
});

test("analytics clear and grants leave the existing application's rows and ACL unchanged", async () => {
  await configureHeaders(key);
  await write([daily], [item]);
  await db.query("select public.coupang_sales_clear_metrics()");
  assert.deepEqual(await snapshot(), { daily: [], items: [] });
  await assert.rejects(db.query("select * from public.other_app_records"), denied);
  await db.exec("reset role;");
  assert.deepEqual((await db.query("select * from public.other_app_records")).rows, [{ id: 1, value: "keep" }]);
  assert.deepEqual((await db.query("select relacl::text, relrowsecurity from pg_class where oid = 'public.other_app_records'::regclass")).rows, originalApp);
  assert.equal((await db.query("select count(*)::integer as count from pg_proc where proname like 'coupang_sales_%' and prosecdef")).rows[0].count, 0);
});

test("a name collision stops reinstallation instead of replacing existing objects or keys", async () => {
  await configureHeaders(key);
  await write([daily], [item]);
  await db.exec("reset role;");
  await assert.rejects(db.exec(sql), /기존 객체/);
  await db.exec("rollback; set role anon;");
  await configureHeaders(key);
  assert.equal((await snapshot()).items.length, 1);
});

test("a separate HTML key retains the private connection and does not grant other application access", async () => {
  const htmlKey = "c".repeat(64);
  const upgrade = fs.readFileSync(new URL("../supabase/allow-standalone.sql", import.meta.url), "utf8")
    .replaceAll("__PRIVATE_KEY_SHA256__", hash)
    .replaceAll("__STANDALONE_KEY_SHA256__", createHash("sha256").update(htmlKey).digest("hex"));
  await db.exec("reset role;");
  await db.exec(upgrade);
  await db.exec("set role anon;");
  await configureHeaders(htmlKey);
  await write([daily], [item]);
  assert.equal((await snapshot()).items.length, 1);
  await assert.rejects(db.query("select * from public.other_app_records"), denied);
  await configureHeaders(key);
  assert.equal((await snapshot()).items.length, 1);
  await configureHeaders(null);
  await assert.rejects(snapshot(), denied);
  await db.exec("reset role;");
  assert.deepEqual((await db.query("select relacl::text, relrowsecurity from pg_class where oid = 'public.other_app_records'::regclass")).rows, originalApp);
});
