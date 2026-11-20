import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadPublishedProject, loadStandaloneConnection } from "../scripts/standalone-build.mjs";

test("HTML builds never fall back to the private server key and only include allowed client fields", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "coupang-html-build-"));
  const directory = path.join(root, "supabase");
  const privatePath = path.join(directory, "connection.local");
  const standalonePath = path.join(directory, "standalone-connection.local");
  await fs.mkdir(directory);
  try {
    await fs.writeFile(privatePath, JSON.stringify({ accessKey: "private server key" }));
    assert.equal(loadStandaloneConnection(root), null);
    const config = { format: "coupang-sales-connection-v1", url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
      publishableKey: "sb_publishable_" + "a".repeat(32), accessKey: "b".repeat(64), snapshotMode: "paged" };
    await fs.writeFile(standalonePath, JSON.stringify({ ...config, serviceRoleKey: "never embed this" }));
    assert.deepEqual(loadStandaloneConnection(root), config);
    await fs.writeFile(standalonePath, JSON.stringify({ ...config, publishableKey: "sb_secret_" + "a".repeat(32) }));
    assert.throws(() => loadStandaloneConnection(root));
  } finally {
    await fs.unlink(standalonePath).catch(() => {});
    await fs.unlink(privatePath);
    await fs.rmdir(directory);
    await fs.rmdir(root);
  }
});

test("the public build can only load project metadata and excludes all access keys", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "coupang-public-build-"));
  const directory = path.join(root, "supabase");
  const filename = path.join(directory, "public-project.json");
  await fs.mkdir(directory);
  try {
    const project = { url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", publishableKey: "sb_publishable_" + "a".repeat(32), siteUrl: "https://example.github.io/analytics/" };
    await fs.writeFile(filename, JSON.stringify({ ...project, accessKey: "never embed", serviceRoleKey: "never embed either" }));
    assert.deepEqual(loadPublishedProject(root), project);
    await fs.writeFile(filename, JSON.stringify({ ...project, publishableKey: "sb_secret_" + "a".repeat(32) }));
    assert.throws(() => loadPublishedProject(root));
  } finally { await fs.unlink(filename).catch(() => {}); await fs.rmdir(directory); await fs.rmdir(root); }
});
