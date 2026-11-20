import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { loadStandaloneConnection } from "./standalone-build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const current = JSON.parse(fs.readFileSync(path.join(root, "supabase/connection.local"), "utf8"));
const old = loadStandaloneConnection(root);
if (old && old.url !== current.url) throw new Error("The standalone connection belongs to another project");
const config = { format: "coupang-sales-connection-v1", url: current.url, publishableKey: current.publishableKey,
  accessKey: old?.accessKey ?? randomBytes(32).toString("hex"), snapshotMode: "paged" };
if (!/^[a-f0-9]{64}$/.test(current.accessKey ?? "")) throw new Error("Invalid private connection");
fs.writeFileSync(path.join(root, "supabase/standalone-connection.local"), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
loadStandaloneConnection(root);
const hash = (key) => createHash("sha256").update(key).digest("hex");
const sql = fs.readFileSync(path.join(root, "supabase/allow-standalone.sql"), "utf8")
  .replaceAll("__PRIVATE_KEY_SHA256__", hash(current.accessKey))
  .replaceAll("__STANDALONE_KEY_SHA256__", hash(config.accessKey));
fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs/allow-standalone.local.sql"), sql, { mode: 0o600 });
console.log(JSON.stringify({ project: new URL(config.url).hostname.split(".")[0], reusedStandaloneKey: Boolean(old), privateKeyEmbedded: false }));
