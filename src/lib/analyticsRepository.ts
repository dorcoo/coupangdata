import type { DailyMetric, ItemMetric } from "../types";
import * as local from "./repository";
import { clearCloudAnalytics, importCloudSnapshot, loadConnection, readCloudSnapshot, writeCloudSnapshot, type CloudConnection } from "./cloudRepository";
import { clearBridgeAnalytics, detectBridge, importLocalSnapshot, readBridgeSnapshot, writeBridgeSnapshot } from "./localBridge";
import { getEmbeddedConnection } from "./embeddedConnection";
import { getPublishedConnection } from "./publishedConnection";

type Backend = { kind: "bridge" } | { kind: "cloud"; connection: CloudConnection } | { kind: "local" };
let backendPromise: Promise<Backend> | null = null;

async function directBackend(connection: CloudConnection): Promise<Backend> {
  const migrationKey = `direct-server-import-v1:${connection.url}`;
  if (!await local.loadPreference<boolean>(migrationKey)) {
    const [daily, items] = await Promise.all([local.loadDaily(), local.loadItems()]);
    if (daily.length || items.length) await importCloudSnapshot(connection, { daily, items });
    await local.savePreference(migrationKey, true);
  }
  return { kind: "cloud", connection };
}

function backend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async (): Promise<Backend> => {
      const published = await getPublishedConnection();
      if (published) return directBackend(published);
      const bridge = await detectBridge();
      if (bridge) {
        const migrationKey = `server-import-v1:${bridge.workspaceId}`;
        if (!await local.loadPreference<boolean>(migrationKey)) {
          const [daily, items] = await Promise.all([local.loadDaily(), local.loadItems()]);
          if (daily.length || items.length) await importLocalSnapshot({ daily, items });
          await local.savePreference(migrationKey, true);
        }
        return { kind: "bridge" };
      }
      const embedded = getEmbeddedConnection();
      if (embedded) return directBackend(embedded);
      const connection = await loadConnection();
      return connection ? { kind: "cloud", connection } : { kind: "local" };
    })().catch((error: unknown) => { backendPromise = null; throw error; });
  }
  return backendPromise;
}

export async function isServerStorage(): Promise<boolean> {
  return (await backend()).kind !== "local";
}

export async function loadDaily(): Promise<DailyMetric[]> {
  const target = await backend();
  if (target.kind === "bridge") return (await readBridgeSnapshot()).daily;
  return target.kind === "cloud" ? (await readCloudSnapshot(target.connection)).daily : local.loadDaily();
}

export async function loadItems(): Promise<ItemMetric[]> {
  const target = await backend();
  if (target.kind === "bridge") return (await readBridgeSnapshot()).items;
  return target.kind === "cloud" ? (await readCloudSnapshot(target.connection)).items : local.loadItems();
}

export async function saveDaily(rows: DailyMetric[]): Promise<void> {
  const target = await backend();
  if (target.kind === "bridge") await writeBridgeSnapshot({ daily: rows, items: [] });
  else if (target.kind === "cloud") await writeCloudSnapshot(target.connection, { daily: rows, items: [] });
  else await local.saveDaily(rows);
}

export async function saveItems(rows: ItemMetric[]): Promise<void> {
  const target = await backend();
  if (target.kind === "bridge") await writeBridgeSnapshot({ daily: [], items: rows });
  else if (target.kind === "cloud") await writeCloudSnapshot(target.connection, { daily: [], items: rows });
  else await local.saveItems(rows);
}

export async function clearAnalyticsData(): Promise<void> {
  const target = await backend();
  if (target.kind === "bridge") await clearBridgeAnalytics();
  else if (target.kind === "cloud") await clearCloudAnalytics(target.connection);
  else await local.clearAnalyticsData();
}
