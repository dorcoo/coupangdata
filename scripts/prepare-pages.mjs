import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStandaloneConnection } from "./standalone-build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const connection = loadStandaloneConnection(root);
if (!connection) throw new Error("Prepare the standalone connection first");
const siteUrl = "https://dorcoo.github.io/coupangdata/";
const project = { url: connection.url, publishableKey: connection.publishableKey, siteUrl };
fs.writeFileSync(path.join(root, "supabase/public-project.json"), JSON.stringify(project, null, 2) + "\n");
const link = new URL(siteUrl);
link.hash = new URLSearchParams({ connect: connection.accessKey }).toString();
fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs/published-connection.local"), JSON.stringify({ url: link.href }) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ project: new URL(connection.url).hostname.split(".")[0], siteUrl, accessKeyInPublicConfig: false }));
