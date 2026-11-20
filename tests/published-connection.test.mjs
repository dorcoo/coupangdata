import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/publishedConnection.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const project = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", publishableKey: "sb_publishable_" + "a".repeat(32),
  siteUrl: "https://example.github.io/analytics/", accessKey: "d".repeat(64) };

function setup({ enabled = true, oldLink = false } = {}) {
  const location = { hash: oldLink ? "#connect=obsolete" : "", pathname: "/analytics/", search: oldLink ? "?connect=old&view=dashboard" : "" };
  let cleaned = false;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports, URLSearchParams,
    __ANALYTICS_PUBLISHED_PROJECT__: enabled ? project : null,
    window: { location, history: { replaceState: (_state, _title, url) => {
      assert.equal(url, "/analytics/?view=dashboard"); cleaned = true; location.hash = "";
    } } },
    require: () => ({
      parseConnection: value => value,
      loadConnection: () => { throw new Error("Do not require a previously configured browser"); },
      rememberCloudConnection: () => { throw new Error("Do not require a private activation link"); },
    }),
  });
  return { api: mod.exports, cleaned: () => cleaned };
}

test("a fresh visitor at the original base URL connects without a private link or saved settings", async () => {
  const connection = await setup().api.getPublishedConnection();
  assert.equal(connection.url, project.url);
  assert.equal(connection.accessKey, project.accessKey);
  assert.equal(connection.snapshotMode, "paged");
});

test("old private links remain usable but cannot override the public website connection", async () => {
  const s = setup({ oldLink: true });
  assert.equal((await s.api.getPublishedConnection()).accessKey, project.accessKey);
  assert.equal(s.cleaned(), true);
});

test("desktop HTML and local development keep their separate connection", async () => {
  assert.equal(await setup({ enabled: false }).api.getPublishedConnection(), null);
});
