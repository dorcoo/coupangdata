import { parseConnection, type CloudConnection } from "./cloudRepository";

declare const __ANALYTICS_STANDALONE_CONNECTION__: unknown;

export function getEmbeddedConnection(): CloudConnection | null {
  if (typeof __ANALYTICS_STANDALONE_CONNECTION__ === "undefined" || !__ANALYTICS_STANDALONE_CONNECTION__) return null;
  return parseConnection(__ANALYTICS_STANDALONE_CONNECTION__);
}
