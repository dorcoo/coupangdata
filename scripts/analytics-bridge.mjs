import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const BODY_LIMIT = 64 * 1024 * 1024;
const unavailable = "자료 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";

function send(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}

async function readConnection(root) {
  let raw;
  try { raw = await fs.readFile(path.join(root, "supabase/connection.local"), "utf8"); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    raw = await fs.readFile(path.join(root, "outputs/coupang-server-connection.local"), "utf8");
  }
  const config = JSON.parse(raw);
  const url = new URL(config.url);
  if (url.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || url.pathname !== "/" || url.search || url.hash || url.port || url.username || url.password
    || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(config.publishableKey ?? "")
    || (config.snapshotMode !== undefined && config.snapshotMode !== "paged")
    || !/^[a-f0-9]{64}$/.test(config.accessKey ?? "")) throw new Error("Invalid server configuration");
  return { ...config, url: url.origin };
}

async function body(request) {
  const parts = [];
  let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > BODY_LIMIT) throw Object.assign(new Error("파일 수를 줄여 다시 가져와 주세요."), { status: 413 });
    parts.push(part);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(parts).toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("자료를 읽을 수 없습니다. 파일을 확인해 주세요."), { status: 400 }); }
  if (!Array.isArray(value.daily) || !Array.isArray(value.items)) {
    throw Object.assign(new Error("자료 형식이 올바르지 않습니다."), { status: 400 });
  }
  return { daily: value.daily, items: value.items };
}

export function createAnalyticsMiddleware({ root, fetchImpl = fetch }) {
  async function remote(config, route, payload, extraHeaders = {}) {
    const response = await fetchImpl(`${config.url}/rest/v1/${route}`, {
      method: "POST",
      headers: { apikey: config.publishableKey, "x-coupang-sync-key": config.accessKey, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(unavailable);
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  return async function analyticsMiddleware(request, response, next) {
    if (!request.url?.split("?")[0].startsWith("/api/analytics/")) { next?.(); return; }
    try {
      const host = request.headers.host ?? "";
      const allowedHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
      const address = request.socket.remoteAddress;
      const allowedAddress = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
      const allowedOrigin = !request.headers.origin || request.headers.origin === `http://${host}`;
      if (!allowedHost || !allowedAddress || !allowedOrigin || request.headers["sec-fetch-site"] === "cross-site") {
        send(response, 403, { error: "이 기기의 분석기에서만 사용할 수 있습니다." }); return;
      }
      const route = request.url.split("?")[0].slice("/api/analytics/".length);
      if (!["status", "snapshot", "save", "clear", "import-local"].includes(route)) {
        send(response, 404, { error: "요청한 기능을 찾을 수 없습니다." }); return;
      }
      const expectedMethod = ["status", "snapshot"].includes(route) ? "GET" : "POST";
      if (request.method !== expectedMethod) { send(response, 405, { error: "허용하지 않는 요청입니다." }); return; }
      if (request.method === "POST" && !/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) {
        send(response, 415, { error: "허용하지 않는 자료 형식입니다." }); return;
      }
      const config = await readConnection(root);
      if (route === "status") {
        const workspaceId = createHash("sha256").update(config.url + "\0" + config.accessKey).digest("hex");
        send(response, 200, { app: "coupang-sales-bridge-v1", workspaceId }); return;
      }
      if (route === "snapshot") {
        if (config.snapshotMode !== "paged") {
          send(response, 200, await remote(config, "rpc/coupang_sales_read_snapshot", {})); return;
        }
        const snapshot = { daily: [], items: [] };
        let cursor = { after_date: null, after_option_id: null };
        const seen = new Set();
        for (;;) {
          const page = await remote(config, "rpc/coupang_sales_read_page", {
            page_size: 5000, ...cursor, include_daily: cursor.after_date === null,
          });
          if (!Array.isArray(page.daily) || !Array.isArray(page.items) || page.items.length > 5000) throw new Error(unavailable);
          if (cursor.after_date === null) snapshot.daily = page.daily;
          snapshot.items.push(...page.items);
          if (page.items.length < 5000) break;
          const last = page.items.at(-1);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(last.metric_date) || typeof last.option_id !== "string") throw new Error(unavailable);
          const marker = JSON.stringify([last.metric_date, last.option_id]);
          if (seen.has(marker)) throw new Error(unavailable);
          seen.add(marker);
          cursor = { after_date: last.metric_date, after_option_id: last.option_id };
        }
        send(response, 200, snapshot); return;
      }
      if (route === "clear") {
        send(response, 200, await remote(config, "rpc/coupang_sales_clear_metrics", {})); return;
      }
      const rows = await body(request);
      if (route === "save") {
        send(response, 200, await remote(config, "rpc/coupang_sales_write_metrics", { daily_rows: rows.daily, item_rows: rows.items })); return;
      }
      // 첫 실행의 기존 자료 이전은 서버에 없는 행만 추가합니다. 중단돼도 재시도할 수 있습니다.
      for (const [table, conflict, values] of [
        ["coupang_sales_daily_metrics", "metric_date", rows.daily],
        ["coupang_sales_item_metrics", "metric_date,option_id", rows.items],
      ]) {
        for (let index = 0; index < values.length; index += 500) {
          await remote(config, `${table}?on_conflict=${conflict}`, values.slice(index, index + 500), { Prefer: "resolution=ignore-duplicates,return=minimal" });
        }
      }
      send(response, 200, { ok: true });
    } catch (error) {
      send(response, error.status ?? 503, { error: error.status ? error.message : unavailable });
    }
  };
}
