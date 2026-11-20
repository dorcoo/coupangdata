import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/analyticsRepository.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const sample = { metric_date: "2026-11-15", option_id: "local-1", revenue: 100 };

function setup({ migrated = false, bridgeFound = true, embedded = null, published = null, publishedFailure = false } = {}) {
  const preferences = new Map(migrated ? [["server-import-v1:workspace", true]] : []);
  const calls = { detect: 0, imported: [], localWrites: 0, legacySettings: 0, directConnections: [] };
  let failImport = false;
  let failSave = false;
  const local = {
    loadDaily: async () => [], loadItems: async () => [sample],
    loadPreference: async (key) => preferences.get(key) ?? null,
    savePreference: async (key, value) => preferences.set(key, value),
    saveItems: async () => { calls.localWrites++; },
  };
  const bridge = {
    detectBridge: async () => { calls.detect++; return bridgeFound ? { workspaceId: "workspace" } : null; },
    importLocalSnapshot: async (data) => { calls.imported.push(data); if (failImport) throw new Error("Import failed"); },
    readBridgeSnapshot: async () => ({ daily: [], items: [{ ...sample, revenue: 200 }] }),
    writeBridgeSnapshot: async () => { if (failSave) throw new Error("Save failed"); },
  };
  const cloud = {
    loadConnection: async () => { calls.legacySettings++; return null; },
    importCloudSnapshot: async (connection, data) => {
      calls.directConnections.push(connection);
      calls.imported.push(data);
      if (failImport) throw new Error("Import failed");
    },
    readCloudSnapshot: async (connection) => {
      calls.directConnections.push(connection);
      return { daily: [], items: [{ ...sample, revenue: 300 }] };
    },
    writeCloudSnapshot: async () => { if (failSave) throw new Error("Save failed"); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (name) => name === "./repository" ? local : name === "./localBridge" ? bridge : name === "./embeddedConnection" ? { getEmbeddedConnection: () => embedded } : name === "./publishedConnection" ? { getPublishedConnection: async () => { if (publishedFailure) throw new Error("Missing private link"); return published; } } : cloud });
  return { api: module.exports, calls, preferences, failImport: (value) => { failImport = value; }, failSave: (value) => { failSave = value; } };
}

test("fresh browsers connect and copy existing local data without a connection file", async () => {
  const { api, calls, preferences } = setup();
  const [daily, items, server] = await Promise.all([api.loadDaily(), api.loadItems(), api.isServerStorage()]);
  assert.deepEqual(daily, []);
  assert.equal(items[0].revenue, 200);
  assert.equal(server, true);
  assert.equal(calls.detect, 1);
  assert.equal(calls.imported.length, 1);
  assert.equal(calls.imported[0].items[0], sample);
  assert.equal(calls.legacySettings, 0);
  assert.equal(preferences.get("server-import-v1:workspace"), true);
});

test("completed automatic copies are not repeated", async () => {
  const { api, calls } = setup({ migrated: true });
  await api.loadItems();
  assert.equal(calls.imported.length, 0);
});

test("interrupted copies retain local data and retry without marking migration complete", async () => {
  const { api, calls, preferences, failImport } = setup();
  failImport(true);
  await assert.rejects(api.loadItems(), /Import failed/);
  assert.equal(preferences.size, 0);
  failImport(false);
  await api.loadItems();
  assert.equal(calls.imported.length, 2);
  assert.equal(sample.revenue, 100);
});

test("failed automatic server writes do not silently fork into local storage", async () => {
  const { api, calls, failSave } = setup({ migrated: true });
  failSave(true);
  await assert.rejects(api.saveItems([sample]), /Save failed/);
  assert.equal(calls.localWrites, 0);
});

test("standalone static previews retain browser storage compatibility", async () => {
  const { api, calls } = setup({ bridgeFound: false });
  assert.equal((await api.loadItems())[0], sample);
  assert.equal(await api.isServerStorage(), false);
  assert.equal(calls.imported.length, 0);
});

test("HTML connects using its embedded scope without a local server or previous browser settings", async () => {
  const embedded = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co" };
  const { api, calls, preferences } = setup({ bridgeFound: false, embedded });
  assert.equal((await api.loadItems())[0].revenue, 300);
  assert.equal(await api.isServerStorage(), true);
  assert.equal(calls.legacySettings, 0);
  assert.ok(calls.directConnections.every(c => c === embedded));
  assert.equal(calls.imported[0].items[0], sample);
  assert.equal(preferences.get(`direct-server-import-v1:${embedded.url}`), true);
});

test("a failed direct copy preserves local originals and retries without overwriting server records", async () => {
  const embedded = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co" };
  const { api, calls, preferences, failImport, failSave } = setup({ bridgeFound: false, embedded });
  failImport(true);
  await assert.rejects(api.loadItems(), /Import failed/);
  assert.equal(preferences.size, 0);
  failImport(false);
  assert.equal((await api.loadItems())[0].revenue, 300);
  assert.equal(calls.imported.length, 2);
  failSave(true);
  await assert.rejects(api.saveItems([sample]), /Save failed/);
  assert.equal(calls.localWrites, 0);
});

test("published browsers use the validated private link without probing a nonexistent local API", async () => {
  const published = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co" };
  const { api, calls } = setup({ published });
  assert.equal((await api.loadItems())[0].revenue, 300);
  assert.equal(calls.detect, 0);
  assert.equal(calls.legacySettings, 0);
  assert.ok(calls.directConnections.every(c => c === published));
});

test("a public visitor without access cannot silently create a disconnected local dataset", async () => {
  const { api, calls } = setup({ publishedFailure: true });
  await assert.rejects(api.loadItems(), /Missing private link/);
  await assert.rejects(api.saveItems([sample]), /Missing private link/);
  assert.equal(calls.detect, 0);
  assert.equal(calls.localWrites, 0);
});
