import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/cloudRepository.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const config = { format: "coupang-sales-connection-v1", url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", publishableKey: "sb_publishable_" + "a".repeat(32), accessKey: "a".repeat(64) };
const empty = { daily: [], items: [] };

function client(handler) {
  const preferences = new Map();
  const requests = [];
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, URL, AbortSignal,
    require: () => ({ loadPreference: async (key) => preferences.get(key) ?? null,
      savePreference: async (key, value) => value === null ? preferences.delete(key) : preferences.set(key, value) }),
    fetch: async (url, options) => { requests.push({ url, options }); return handler(url, options); },
  });
  return { api: module.exports, preferences, requests };
}
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("connection files reject secret keys, non-Supabase destinations, and embedded credentials", () => {
  const { api } = client(() => reply(empty));
  for (const invalid of [
    { ...config, publishableKey: "sb_secret_" + "a".repeat(32) },
    { ...config, url: "https://example.com" },
    { ...config, url: "https://person:password@aaaaaaaaaaaaaaaaaaaa.supabase.co" },
    { ...config, accessKey: "short" },
  ]) assert.throws(() => api.parseConnection(invalid));
});

test("server validation failure never replaces the saved connection", async () => {
  const { api, preferences } = client(() => reply(false));
  await assert.rejects(api.connectCloud(config), /일치하지/);
  assert.equal(preferences.size, 0);
});

test("validated settings are stored outside the HTML and can be disconnected", async () => {
  const { api, requests } = client((url) => reply(url.endsWith("access_granted") ? true : empty));
  await api.connectCloud(config);
  assert.equal((await api.loadConnection()).url, config.url);
  assert.equal(requests[0].options.headers["x-coupang-sync-key"], config.accessKey);
  assert.equal(requests[0].options.headers.apikey, config.publishableKey);
  await api.disconnectCloud();
  assert.equal(await api.loadConnection(), null);
});

test("parallel daily and item reads share one snapshot request", async () => {
  const { api, requests } = client(() => reply(empty));
  await Promise.all([api.readCloudSnapshot(config), api.readCloudSnapshot(config)]);
  assert.equal(requests.length, 1);
});

test("missing server installation produces a useful message and preserves local mode", async () => {
  const { api, preferences } = client(() => reply({ code: "PGRST202" }, 404));
  await assert.rejects(api.connectCloud(config), /자료 저장소가 준비되지/);
  assert.equal(preferences.size, 0);
});

test("invalid server responses cannot silently replace data with an empty dataset", async () => {
  const { api } = client(() => reply({ daily: [] }));
  await assert.rejects(api.readCloudSnapshot(config), /자료 형식/);
});

test("failed writes report failure instead of success", async () => {
  const { api } = client(() => reply({ code: "42501" }, 403));
  await assert.rejects(api.writeCloudSnapshot(config, empty), /자료에 연결하지/);
});

test("web activation verifies access before remembering the key without reading the entire dataset twice", async () => {
  let allowed = true;
  const { api, requests, preferences } = client(() => reply(allowed));
  await api.rememberCloudConnection(config);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith("coupang_sales_access_granted"));
  allowed = false;
  await assert.rejects(api.rememberCloudConnection({ ...config, accessKey: "b".repeat(64) }), /올바르지/);
  assert.equal((await api.loadConnection()).accessKey, config.accessKey);
  assert.equal(preferences.size, 1);
});

test("direct HTML reads every page with a composite cursor and shares parallel reads", async () => {
  const first = Array.from({ length: 5000 }, (_, n) => ({ metric_date: "2026-10-04", option_id: String(n) }));
  const pages = [{ daily: [{ metric_date: "2026-10-04" }], items: first }, { daily: [], items: [{ metric_date: "2026-10-04", option_id: "last" }] }];
  const { api, requests } = client(() => reply(pages.shift()));
  const c = api.parseConnection({ ...config, snapshotMode: "paged" });
  const [left, right] = await Promise.all([api.readCloudSnapshot(c), api.readCloudSnapshot(c)]);
  assert.equal(left, right);
  assert.equal(left.items.length, 5001);
  assert.equal(left.daily.length, 1);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(r => r.url.includes("/rpc/coupang_sales_read_page")));
  assert.deepEqual(JSON.parse(requests[1].options.body), { page_size: 5000, after_date: "2026-10-04", after_option_id: "4999", include_daily: false });
});

test("an interrupted direct read never reports a partial snapshot", async () => {
  const first = Array.from({ length: 5000 }, (_, n) => ({ metric_date: "2026-10-04", option_id: String(n) }));
  const { api } = client((url, options) => JSON.parse(options.body).after_date ? reply({ code: "57014" }, 500) : reply({ daily: [], items: first }));
  await assert.rejects(api.readCloudSnapshot({ ...config, snapshotMode: "paged" }), /완료하지 못/);
});

test("direct migration adds only missing rows in bounded batches", async () => {
  const { api, requests } = client(() => new Response(null, { status: 204 }));
  await api.importCloudSnapshot(config, { daily: [], items: Array.from({ length: 501 }, (_, n) => ({ option_id: String(n) })) });
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[0].options.body).length, 500);
  assert.equal(JSON.parse(requests[1].options.body).length, 1);
  for (const request of requests) {
    assert.equal(request.options.headers.Prefer, "resolution=ignore-duplicates,return=minimal");
    assert.match(request.url, /coupang_sales_item_metrics\?on_conflict=metric_date,option_id$/);
  }
});
