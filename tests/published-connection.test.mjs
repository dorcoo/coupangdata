import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/publishedConnection.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const project = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", publishableKey: "sb_publishable_" + "a".repeat(32), siteUrl: "https://example.github.io/analytics/" };
const key = "b".repeat(64);

function setup({ hash = "", saved = null, enabled = true, reject = false } = {}) {
  const location = { hash, pathname: "/analytics/", search: "?view=dashboard" };
  const remembered = [];
  let value = saved;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports, URLSearchParams,
    __ANALYTICS_PUBLISHED_PROJECT__: enabled ? project : null,
    window: { location, history: { replaceState: (_state, _title, url) => { assert.equal(url, "/analytics/?view=dashboard"); location.hash = ""; } } },
    require: () => ({ loadConnection: async () => value, rememberCloudConnection: async (connection) => {
      assert.equal(location.hash, "", "remove the capability from the address before any network request");
      remembered.push(connection);
      if (reject) throw new Error("Invalid connection");
      value = connection;
      return connection;
    } }),
  });
  return { api: mod.exports, location, remembered, saved: () => value };
}

test("a private URL activates once, removes its fragment, and then works at the original base URL", async () => {
  const s = setup({ hash: "#connect=" + key });
  const first = await s.api.getPublishedConnection();
  assert.equal(first.accessKey, key);
  assert.equal(first.url, project.url);
  assert.equal(first.snapshotMode, "paged");
  assert.equal(s.location.hash, "");
  assert.equal((await s.api.getPublishedConnection()).accessKey, key);
  assert.equal(s.remembered.length, 1);
});

test("visitors without a link and settings for another project cannot read private sales data", async () => {
  await assert.rejects(setup().api.getPublishedConnection(), /연결 링크/);
  await assert.rejects(setup({ saved: { url: "https://other.supabase.co", publishableKey: project.publishableKey, accessKey: key } }).api.getPublishedConnection(), /연결 링크/);
});

test("a rejected link cannot replace a previously working browser connection", async () => {
  const saved = { url: project.url, publishableKey: project.publishableKey, accessKey: key };
  const s = setup({ hash: "#connect=wrong", saved, reject: true });
  await assert.rejects(s.api.getPublishedConnection(), /Invalid connection/);
  assert.equal(s.saved(), saved);
});

test("desktop HTML and local development do not require a published connection", async () => {
  assert.equal(await setup({ enabled: false }).api.getPublishedConnection(), null);
});
