import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStandaloneConnection } from "./standalone-build.mjs";
import { createHash, randomBytes } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const connection = loadStandaloneConnection(root);
if (!connection) throw new Error("Prepare the standalone connection first");
const siteUrl = "https://dorcoo.github.io/coupangdata/";
const filename = path.join(root, "supabase/public-project.json");
const previous = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, "utf8")) : null;
const server = JSON.parse(fs.readFileSync(path.join(root, "supabase/connection.local"), "utf8"));
if (server.url !== connection.url || (previous && previous.url !== connection.url)) throw new Error("Project mismatch");
const accessKey = previous?.accessKey ?? randomBytes(32).toString("hex");
if (!/^[a-f0-9]{64}$/.test(accessKey) || [connection.accessKey, server.accessKey].includes(accessKey)) throw new Error("Use a separate public web key");
const project = { url: connection.url, publishableKey: connection.publishableKey, siteUrl, accessKey };
fs.writeFileSync(filename, JSON.stringify(project, null, 2) + "\n");
fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
const hash = (key) => createHash("sha256").update(key).digest("hex");
const sql = fs.readFileSync(path.join(root, "supabase/allow-public.sql"), "utf8")
  .replaceAll("__PRIVATE_KEY_SHA256__", hash(server.accessKey))
  .replaceAll("__STANDALONE_KEY_SHA256__", hash(connection.accessKey))
  .replaceAll("__PUBLIC_KEY_SHA256__", hash(accessKey));
fs.writeFileSync(path.join(root, "outputs/allow-public.local.sql"), sql, { mode: 0o600 });
fs.writeFileSync(path.join(root, "outputs/published-connection.local"), JSON.stringify({ url: siteUrl }) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ project: new URL(connection.url).hostname.split(".")[0], siteUrl, publicWebAccessEnabled: true, privateKeysPublished: false }));
