import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const [serverUrl, publishableKey] = process.argv.slice(2);
const url = new URL(serverUrl ?? "");
if (url.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
  || url.pathname !== "/" || url.search || url.hash || url.username || url.password || url.port
  || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publishableKey ?? "")) {
  throw new Error("Supabase 프로젝트 URL과 Publishable key를 지정해 주세요. 관리자 비밀 키는 사용하지 않습니다.");
}
const output = path.join(root, "outputs");
fs.mkdirSync(output, { recursive: true });
const connectionPath = path.join(output, "coupang-server-connection.local");
const privateConnectionPath = path.join(root, "supabase/connection.local");
let previous;
if (fs.existsSync(privateConnectionPath)) previous = JSON.parse(fs.readFileSync(privateConnectionPath, "utf8"));
else if (fs.existsSync(connectionPath)) previous = JSON.parse(fs.readFileSync(connectionPath, "utf8"));
if (previous && previous.url !== url.origin) throw new Error("다른 프로젝트 연결 파일이 이미 있습니다. 기존 파일을 보관한 뒤 새 연결을 준비해 주세요.");
const accessKey = previous?.accessKey ?? randomBytes(32).toString("hex");
if (!/^[a-f0-9]{64}$/.test(accessKey)) throw new Error("기존 연결 파일의 접근 키가 올바르지 않습니다.");
const connection = { format: "coupang-sales-connection-v1", url: url.origin, publishableKey, accessKey,
  snapshotMode: previous ? previous.snapshotMode : "paged" };
fs.writeFileSync(connectionPath, JSON.stringify(connection, null, 2) + "\n", { mode: 0o600 });
fs.writeFileSync(privateConnectionPath, JSON.stringify(connection, null, 2) + "\n", { mode: 0o600 });
const hash = createHash("sha256").update(accessKey).digest("hex");
const template = fs.readFileSync(path.join(root, "supabase/shared-project.sql"), "utf8");
const sqlPath = path.join(output, "coupang-shared-project.local.sql");
fs.writeFileSync(sqlPath, `-- 대상 프로젝트: ${url.origin}\n` + template.replaceAll("__WORKSPACE_KEY_SHA256__", hash));
console.log(JSON.stringify({ project: url.hostname.split(".")[0], connectionPath, sqlPath, reusedAccessKey: Boolean(previous), secretPrinted: false }));
