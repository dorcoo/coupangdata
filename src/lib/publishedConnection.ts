import { loadConnection, rememberCloudConnection, type CloudConnection } from "./cloudRepository";

declare const __ANALYTICS_PUBLISHED_PROJECT__: {
  url: string;
  publishableKey: string;
  siteUrl: string;
} | null;

export async function getPublishedConnection(): Promise<CloudConnection | null> {
  if (typeof __ANALYTICS_PUBLISHED_PROJECT__ === "undefined" || !__ANALYTICS_PUBLISHED_PROJECT__) return null;
  const project = __ANALYTICS_PUBLISHED_PROJECT__;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.has("connect")) {
    const accessKey = hash.get("connect");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return rememberCloudConnection({ format: "coupang-sales-connection-v1", url: project.url,
      publishableKey: project.publishableKey, accessKey, snapshotMode: "paged" });
  }
  const saved = await loadConnection();
  if (saved?.url === project.url && saved.publishableKey === project.publishableKey) return { ...saved, snapshotMode: "paged" };
  throw new Error("처음에는 전달받은 분석기 연결 링크로 열어 주세요. 연결 후에는 이 주소로 바로 사용할 수 있습니다.");
}
