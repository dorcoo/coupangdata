import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5173";

async function ready() {
  try {
    const response = await fetch(`${url}/api/analytics/status`, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.json()).app === "coupang-sales-bridge-v1";
  } catch { return false; }
}

if (!await ready()) {
  const output = fs.openSync(path.join(root, "vite-dev.launch.log"), "a");
  const errors = fs.openSync(path.join(root, "vite-dev.launch.err.log"), "a");
  const child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
    cwd: root, detached: true, stdio: ["ignore", output, errors], windowsHide: true,
  });
  child.unref();
  fs.closeSync(output);
  fs.closeSync(errors);
  let started = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await ready()) { started = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!started) {
    console.error("분석기를 시작하지 못했습니다. 실행 중인 분석기 창을 닫은 뒤 다시 열어 주세요.");
    process.exit(1);
  }
}

if (!process.argv.includes("--no-open")) {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
}
console.log("분석기가 준비되었습니다.");
