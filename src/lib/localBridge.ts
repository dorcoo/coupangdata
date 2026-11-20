import type { AnalyticsSnapshot } from "./cloudRepository";

interface BridgeStatus { app: "coupang-sales-bridge-v1"; workspaceId: string }

async function request<T>(route: string, data?: AnalyticsSnapshot): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/analytics/${route}`, {
      method: data || route === "clear" ? "POST" : "GET",
      headers: data || route === "clear" ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : route === "clear" ? "{}" : undefined,
      signal: AbortSignal.timeout(["import-local", "snapshot"].includes(route) ? 180000 : 70000),
    });
  } catch { throw new Error("자료를 불러오거나 저장하지 못했습니다. 인터넷 연결 후 다시 시도해 주세요."); }
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || "자료를 처리하지 못했습니다. 다시 시도해 주세요.");
  }
  return response.json() as Promise<T>;
}

export async function detectBridge(): Promise<BridgeStatus | null> {
  if (typeof window === "undefined" || !/^https?:$/.test(window.location.protocol)) return null;
  let response: Response;
  try { response = await fetch("/api/analytics/status", { signal: AbortSignal.timeout(5000) }); }
  catch { throw new Error("분석기를 연결하지 못했습니다. 실행 파일을 다시 열어 주세요."); }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("자료 저장소에 연결하지 못했습니다. 분석기를 다시 실행해 주세요.");
  const result = await response.json().catch(() => null) as BridgeStatus | null;
  return result?.app === "coupang-sales-bridge-v1" && /^[a-f0-9]{64}$/.test(result.workspaceId) ? result : null;
}

let pendingSnapshot: Promise<AnalyticsSnapshot> | null = null;
export async function readBridgeSnapshot(): Promise<AnalyticsSnapshot> {
  if (pendingSnapshot) return pendingSnapshot;
  const pending = request<AnalyticsSnapshot>("snapshot").then((snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.daily) || !Array.isArray(snapshot.items)) throw new Error("자료를 읽지 못했습니다. 다시 시도해 주세요.");
    return snapshot;
  });
  pendingSnapshot = pending;
  try { return await pending; }
  finally { if (pendingSnapshot === pending) pendingSnapshot = null; }
}

export async function writeBridgeSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
  await request("save", snapshot);
  pendingSnapshot = null;
}

export async function importLocalSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
  await request("import-local", snapshot);
  pendingSnapshot = null;
}

export async function clearBridgeAnalytics(): Promise<void> {
  await request("clear");
  pendingSnapshot = null;
}
