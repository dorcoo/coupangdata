import assert from "node:assert/strict";
import fs from "node:fs";
import { beforeEach, test } from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import ts from "typescript";

let sequence = 0;
let legacy;
const source = fs.readFileSync(new URL("../src/lib/repository.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const loadRepository = () => import(`data:text/javascript;base64,${Buffer.from(`${compiled}\n// ${sequence++}`).toString("base64")}`);
const daily = { metric_date: "2026-11-15", revenue: 100 };
const item = { metric_date: "2026-11-15", option_id: "option-1", revenue: 100 };

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  legacy = new Map();
  globalThis.localStorage = {
    getItem: (key) => legacy.get(key) ?? null,
    setItem: (key, value) => legacy.set(key, value),
    removeItem: (key) => legacy.delete(key),
  };
});

test("existing local data migrates once and concurrent initial reads keep both datasets", async () => {
  legacy.set("coupang.daily_metrics", JSON.stringify([daily]));
  legacy.set("coupang.item_metrics", JSON.stringify([item]));
  const repository = await loadRepository();
  const [dailyRows, items] = await Promise.all([repository.loadDaily(), repository.loadItems()]);
  assert.deepEqual(dailyRows, [daily]);
  assert.deepEqual(items, [item]);
  assert.equal(legacy.get("coupang.item_metrics"), JSON.stringify([item]));

  await repository.saveItems([{ ...item, revenue: 200 }]);
  const reloaded = await loadRepository();
  assert.equal((await reloaded.loadItems())[0].revenue, 200);
});

test("invalid legacy data aborts migration and keeps the original backup for retry", async () => {
  legacy.set("coupang.daily_metrics", JSON.stringify([daily]));
  legacy.set("coupang.item_metrics", "not JSON");
  const repository = await loadRepository();
  await assert.rejects(repository.loadDaily());
  assert.equal(legacy.get("coupang.item_metrics"), "not JSON");
  legacy.set("coupang.item_metrics", JSON.stringify([item]));
  assert.deepEqual(await repository.loadDaily(), [daily]);
  assert.deepEqual(await repository.loadItems(), [item]);
});

test("saving the same date and option updates that row while preserving other dates", async () => {
  const repository = await loadRepository();
  await repository.saveItems([item, { ...item, metric_date: "2026-11-14" }]);
  await repository.saveItems([{ ...item, revenue: 200 }]);
  assert.deepEqual((await repository.loadItems()).map((row) => [row.metric_date, row.revenue]), [
    ["2026-11-14", 100], ["2026-11-15", 200],
  ]);
});

test("quota failure rejects the save and rolls back earlier writes in that batch", async (t) => {
  const repository = await loadRepository();
  await repository.saveItems([item]);
  const originalPut = IDBObjectStore.prototype.put;
  let writes = 0;
  const mock = t.mock.method(IDBObjectStore.prototype, "put", function (...args) {
    if (this.name === "items" && ++writes === 2) throw new DOMException("Full", "QuotaExceededError");
    return originalPut.apply(this, args);
  });
  await assert.rejects(repository.saveItems([
    { ...item, revenue: 200 }, { ...item, option_id: "option-2" },
  ]), /저장 공간이 부족/);
  mock.mock.restore();
  assert.deepEqual(await repository.loadItems(), [item]);
});

test("invalid rows cannot leave a partially saved batch", async () => {
  const repository = await loadRepository();
  await repository.loadItems();
  await assert.rejects(repository.saveItems([item, { metric_date: "2026-11-15" }]));
  assert.deepEqual(await repository.loadItems(), []);
});

test("datasets larger than localStorage capacity save without writing localStorage", async () => {
  const repository = await loadRepository();
  localStorage.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  const rows = Array.from({ length: 4000 }, (_, index) => ({
    ...item, option_id: String(index), option_name: "x".repeat(1800),
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(rows)) > 5 * 1024 * 1024);
  await repository.saveItems(rows);
  assert.equal((await repository.loadItems()).length, rows.length);
});

test("clear removes both datasets and reload cannot reimport a stale legacy backup", async () => {
  legacy.set("coupang.daily_metrics", JSON.stringify([daily]));
  legacy.set("coupang.item_metrics", JSON.stringify([item]));
  const repository = await loadRepository();
  await repository.loadItems();
  await repository.clearAnalyticsData();
  assert.equal(legacy.size, 0);
  legacy.set("coupang.item_metrics", JSON.stringify([item]));
  const reloaded = await loadRepository();
  assert.deepEqual(await reloaded.loadDaily(), []);
  assert.deepEqual(await reloaded.loadItems(), []);
});

test("unsupported storage reports an error instead of claiming a save succeeded", async () => {
  delete globalThis.indexedDB;
  const repository = await loadRepository();
  await assert.rejects(repository.saveItems([item]), /저장소를 사용할 수 없습니다/);
});
