import type { Plugin } from "vite";

export function loadPublishedProject(root: string): { url: string; publishableKey: string; siteUrl: string; accessKey: string };
export function loadStandaloneConnection(root: string): {
  format: "coupang-sales-connection-v1";
  url: string;
  publishableKey: string;
  accessKey: string;
  snapshotMode: "paged";
} | null;
export function standaloneBuildPlugin(root: string, connection: unknown): Plugin;
