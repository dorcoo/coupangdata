import type { DailyMetric, ItemMetric } from "../types";
import { loadPreference, savePreference } from "./repository";

const CONNECTION_KEY = "coupang-sales-server-v1";

export interface CloudConnection {
  format: "coupang-sales-connection-v1";
  url: string;
  publishableKey: string;
  accessKey: string;
  snapshotMode?: "paged";
}

export interface AnalyticsSnapshot {
  daily: DailyMetric[];
  items: ItemMetric[];
}

export function parseConnection(value: unknown): CloudConnection {
  if (!value || typeof value !== "object") throw new Error("저장 설정을 읽지 못했습니다. 분석기를 다시 실행해 주세요.");
  const candidate = value as Partial<CloudConnection>;
  let url: URL;
  try { url = new URL(candidate.url ?? ""); }
  catch { throw new Error("저장 설정을 읽지 못했습니다. 분석기를 다시 실행해 주세요."); }
  if (candidate.format !== "coupang-sales-connection-v1" || url.protocol !== "https:"
    || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || url.pathname !== "/" || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error("저장 설정을 읽지 못했습니다. 분석기를 다시 실행해 주세요.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(candidate.publishableKey ?? "")) {
    throw new Error("저장소 연결을 확인하지 못했습니다. 분석기를 다시 실행해 주세요.");
  }
  if (!/^[a-f0-9]{64}$/.test(candidate.accessKey ?? "")) {
    throw new Error("저장소 연결을 확인하지 못했습니다. 분석기를 다시 실행해 주세요.");
  }
  if (candidate.snapshotMode !== undefined && candidate.snapshotMode !== "paged") {
    throw new Error("저장 설정을 읽지 못했습니다. HTML 파일을 다시 열어 주세요.");
  }
  return { format: "coupang-sales-connection-v1", url: url.origin, publishableKey: candidate.publishableKey!,
    accessKey: candidate.accessKey!, ...(candidate.snapshotMode ? { snapshotMode: candidate.snapshotMode } : {}) };
}

export async function loadConnection(): Promise<CloudConnection | null> {
  const saved = await loadPreference<unknown>(CONNECTION_KEY);
  return saved === null ? null : parseConnection(saved);
}

async function post<T>(connection: CloudConnection, resource: string, body: object = {}, extraHeaders: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${connection.url}/rest/v1/${resource}`, {
      method: "POST",
      headers: {
        apikey: connection.publishableKey,
        "Content-Type": "application/json",
        "x-coupang-sync-key": connection.accessKey,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(resource === "rpc/coupang_sales_write_metrics" ? 90000 : 60000),
    });
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요. 브라우저에 보관한 기존 자료는 유지됩니다.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string };
    if (error.code === "57014" && resource === "rpc/coupang_sales_write_metrics") {
      throw new Error("서버 처리 시간이 초과되어 저장을 취소했습니다. 기존 자료와 선택한 파일은 유지됩니다. 잠시 후 다시 저장해 주세요.");
    }
    if (error.code === "PGRST202" || error.code === "PGRST205") {
      throw new Error("자료 저장소가 준비되지 않았습니다. 분석기를 다시 실행해 주세요.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("자료에 연결하지 못했습니다. 분석기를 다시 실행해 주세요.");
    }
    throw new Error(`서버 작업을 완료하지 못했습니다 (${response.status}). 자료를 확인한 뒤 다시 시도해 주세요.`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const rpc = <T>(connection: CloudConnection, name: string, body: object = {}) => post<T>(connection, `rpc/${name}`, body);

function validateSnapshot(value: AnalyticsSnapshot): AnalyticsSnapshot {
  if (!value || !Array.isArray(value.daily) || !Array.isArray(value.items)) {
    throw new Error("서버의 분석 자료 형식이 올바르지 않습니다. 기존 자료는 유지됩니다.");
  }
  return value;
}

async function readSnapshot(connection: CloudConnection): Promise<AnalyticsSnapshot> {
  if (connection.snapshotMode !== "paged") return validateSnapshot(await rpc(connection, "coupang_sales_read_snapshot"));
  const snapshot: AnalyticsSnapshot = { daily: [], items: [] };
  let afterDate: string | null = null;
  let afterOptionId: string | null = null;
  const seen = new Set<string>();
  for (;;) {
    const page = validateSnapshot(await rpc(connection, "coupang_sales_read_page", {
      page_size: 5000, after_date: afterDate, after_option_id: afterOptionId, include_daily: afterDate === null,
    }));
    if (page.items.length > 5000) throw new Error("자료를 읽지 못했습니다. HTML 파일을 다시 열어 주세요.");
    if (afterDate === null) snapshot.daily = page.daily;
    snapshot.items.push(...page.items);
    if (page.items.length < 5000) return snapshot;
    const last = page.items.at(-1)!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(last.metric_date) || typeof last.option_id !== "string") {
      throw new Error("서버의 분석 자료 형식이 올바르지 않습니다. 기존 자료는 유지됩니다.");
    }
    const cursor = JSON.stringify([last.metric_date, last.option_id]);
    if (seen.has(cursor)) throw new Error("자료를 읽지 못했습니다. HTML 파일을 다시 열어 주세요.");
    seen.add(cursor);
    afterDate = last.metric_date;
    afterOptionId = last.option_id;
  }
}

let pendingSnapshot: { connectionId: string; request: Promise<AnalyticsSnapshot> } | null = null;

export async function readCloudSnapshot(connection: CloudConnection): Promise<AnalyticsSnapshot> {
  const connectionId = JSON.stringify([connection.url, connection.publishableKey, connection.accessKey, connection.snapshotMode]);
  if (pendingSnapshot?.connectionId === connectionId) return pendingSnapshot.request;
  const request = readSnapshot(connection);
  pendingSnapshot = { connectionId, request };
  try { return await request; }
  finally { if (pendingSnapshot?.request === request) pendingSnapshot = null; }
}

export async function connectCloud(value: unknown): Promise<CloudConnection> {
  const connection = parseConnection(value);
  const allowed = await rpc<boolean>(connection, "coupang_sales_access_granted");
  if (allowed !== true) throw new Error("저장소 연결 정보가 일치하지 않습니다.");
  await readCloudSnapshot(connection);
  await savePreference(CONNECTION_KEY, connection);
  return connection;
}

export async function rememberCloudConnection(value: unknown): Promise<CloudConnection> {
  const connection = parseConnection(value);
  if (await rpc<boolean>(connection, "coupang_sales_access_granted") !== true) {
    throw new Error("자료 연결 링크가 올바르지 않습니다. 전달받은 링크로 다시 열어 주세요.");
  }
  await savePreference(CONNECTION_KEY, connection);
  pendingSnapshot = null;
  return connection;
}

export async function disconnectCloud(): Promise<void> {
  await savePreference(CONNECTION_KEY, null);
  pendingSnapshot = null;
}

export async function writeCloudSnapshot(connection: CloudConnection, snapshot: AnalyticsSnapshot): Promise<void> {
  await rpc(connection, "coupang_sales_write_metrics", { daily_rows: snapshot.daily, item_rows: snapshot.items });
  pendingSnapshot = null;
}

export async function importCloudSnapshot(connection: CloudConnection, snapshot: AnalyticsSnapshot): Promise<void> {
  for (const [table, conflict, rows] of [
    ["coupang_sales_daily_metrics", "metric_date", snapshot.daily],
    ["coupang_sales_item_metrics", "metric_date,option_id", snapshot.items],
  ] as const) {
    for (let index = 0; index < rows.length; index += 500) {
      await post(connection, `${table}?on_conflict=${conflict}`, rows.slice(index, index + 500), {
        Prefer: "resolution=ignore-duplicates,return=minimal",
      });
    }
  }
  pendingSnapshot = null;
}

export async function clearCloudAnalytics(connection: CloudConnection): Promise<void> {
  await rpc(connection, "coupang_sales_clear_metrics");
  pendingSnapshot = null;
}
