import { parseConnection, type CloudConnection } from "./cloudRepository";

declare const __ANALYTICS_PUBLISHED_PROJECT__: {
  url: string;
  publishableKey: string;
  siteUrl: string;
  accessKey: string;
} | null;

export async function getPublishedConnection(): Promise<CloudConnection | null> {
  if (typeof __ANALYTICS_PUBLISHED_PROJECT__ === "undefined" || !__ANALYTICS_PUBLISHED_PROJECT__) return null;
  const project = __ANALYTICS_PUBLISHED_PROJECT__;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.has("connect")) {
    const search = new URLSearchParams(window.location.search);
    search.delete("connect");
    const query = search.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }
  return parseConnection({ format: "coupang-sales-connection-v1", url: project.url,
    publishableKey: project.publishableKey, accessKey: project.accessKey, snapshotMode: "paged" });
}
