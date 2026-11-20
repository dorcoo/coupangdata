import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createAnalyticsMiddleware } from "../scripts/analytics-bridge.mjs";

const config = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", publishableKey: "sb_publishable_" + "a".repeat(32), accessKey: "a".repeat(64) };
const remoteRequests = [];
let root, server, base;
let failRemote = false;
let remotePages = [];

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "coupang-bridge-test-"));
  await fs.mkdir(path.join(root, "supabase"));
  await fs.writeFile(path.join(root, "supabase/connection.local"), JSON.stringify(config));
  const middleware = createAnalyticsMiddleware({ root, fetchImpl: async (url, options) => {
    remoteRequests.push({ url, options });
    if (failRemote) return new Response(JSON.stringify({ message: "private database detail" }), { status: 500 });
    if (url.includes("read_page")) return Response.json(remotePages.shift());
    if (url.includes("read_snapshot")) return Response.json({ daily: [], items: [] });
    return new Response(null, { status: 204 });
  } });
  server = http.createServer((request, response) => middleware(request, response, () => { response.writeHead(404); response.end(); }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });
const post = (route, value, extra = {}) => fetch(`${base}/api/analytics/${route}`, {
  method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(value),
});

test("automatic connection status never sends connection credentials to the browser", async () => {
  const response = await fetch(`${base}/api/analytics/status`);
  const value = await response.text();
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(value).app, "coupang-sales-bridge-v1");
  for (const secret of [config.url, config.publishableKey, config.accessKey]) assert.equal(value.includes(secret), false);
});

test("snapshot requests use the private server connection automatically", async () => {
  const response = await fetch(`${base}/api/analytics/snapshot`);
  assert.deepEqual(await response.json(), { daily: [], items: [] });
  const sent = remoteRequests.at(-1);
  assert.equal(sent.options.headers["x-coupang-sync-key"], config.accessKey);
  assert.equal(sent.options.headers.apikey, config.publishableKey);
});

test("large snapshots follow the full cursor and combine all pages without duplicating daily rows", async () => {
  await fs.writeFile(path.join(root, "supabase/connection.local"), JSON.stringify({ ...config, snapshotMode: "paged" }));
  const first = Array.from({ length: 5000 }, (_, index) => ({ metric_date: "2026-10-04", option_id: String(index) }));
  remotePages = [{ daily: [{ metric_date: "2026-10-04" }], items: first }, { daily: [], items: [{ metric_date: "2026-10-05", option_id: "last" }] }];
  const start = remoteRequests.length;
  try {
    const response = await fetch(`${base}/api/analytics/snapshot`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.daily.length, 1);
    assert.equal(result.items.length, 5001);
    const calls = remoteRequests.slice(start).map(r => JSON.parse(r.options.body));
    assert.equal(calls[0].include_daily, true);
    assert.deepEqual(calls[1], { page_size: 5000, after_date: "2026-10-04", after_option_id: "4999", include_daily: false });
  } finally { await fs.writeFile(path.join(root, "supabase/connection.local"), JSON.stringify(config)); }
});

test("a repeated server cursor fails instead of returning incomplete data or looping", async () => {
  await fs.writeFile(path.join(root, "supabase/connection.local"), JSON.stringify({ ...config, snapshotMode: "paged" }));
  const page = { daily: [], items: Array.from({ length: 5000 }, () => ({ metric_date: "2026-10-04", option_id: "same" })) };
  remotePages = [page, page];
  try {
    const response = await fetch(`${base}/api/analytics/snapshot`);
    assert.equal(response.status, 503);
  } finally { await fs.writeFile(path.join(root, "supabase/connection.local"), JSON.stringify(config)); }
});

test("foreign origins and DNS rebinding hosts cannot use the local connection", async () => {
  assert.equal((await post("save", { daily: [], items: [] }, { Origin: "https://example.com" })).status, 403);
  const rebound = await new Promise((resolve, reject) => {
    http.get(`${base}/api/analytics/status`, { headers: { Host: "example.com" } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on("error", reject);
  });
  assert.equal(rebound, 403);
});

test("only the expected methods and analysis operations are available", async () => {
  assert.equal((await fetch(`${base}/api/analytics/clear`)).status, 405);
  assert.equal((await post("other_app_table", {})).status, 404);
  assert.equal((await fetch(`${base}/api/analytics/clear`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" })).status, 415);
});

test("local migration copies in bounded batches and never overwrites existing server rows", async () => {
  const start = remoteRequests.length;
  const rows = Array.from({ length: 501 }, (_, index) => ({ metric_date: "2026-11-15", option_id: String(index) }));
  const response = await post("import-local", { daily: [], items: rows });
  assert.equal(response.status, 200);
  const calls = remoteRequests.slice(start);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].options.body).length, 500);
  assert.equal(JSON.parse(calls[1].options.body).length, 1);
  for (const call of calls) assert.equal(call.options.headers.Prefer, "resolution=ignore-duplicates,return=minimal");
});

test("server errors are reported without database messages or secrets", async () => {
  failRemote = true;
  try {
    const response = await post("save", { daily: [], items: [] });
    const text = await response.text();
    assert.equal(response.status, 503);
    assert.equal(text.includes("private database detail"), false);
    assert.equal(text.includes(config.accessKey), false);
  } finally { failRemote = false; }
});
