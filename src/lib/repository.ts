import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, DailyMetric, ItemMetric } from "../types";

const DAILY_KEY = "coupang.daily_metrics";
const ITEM_KEY = "coupang.item_metrics";
const CONVERSATION_KEY = "coupang.conversations";

function readLocal<T>(key: string): T[] {
  return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
}

function saveLocal<T>(key: string, values: T[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

function chunks<T>(values: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function loadDaily(client: SupabaseClient | null): Promise<DailyMetric[]> {
  if (!client) return readLocal<DailyMetric>(DAILY_KEY);
  const { data, error } = await client.from("daily_metrics").select("*").order("metric_date");
  if (error) throw error;
  return (data ?? []) as DailyMetric[];
}

export async function saveDaily(client: SupabaseClient | null, rows: DailyMetric[]): Promise<void> {
  if (!client) {
    const mapped = new Map(readLocal<DailyMetric>(DAILY_KEY).map((row) => [row.metric_date, row]));
    rows.forEach((row) => mapped.set(row.metric_date, row));
    saveLocal(DAILY_KEY, [...mapped.values()].sort((a, b) => a.metric_date.localeCompare(b.metric_date)));
    return;
  }
  for (const group of chunks(rows)) {
    const { error } = await client.from("daily_metrics").upsert(group, { onConflict: "user_id,metric_date" });
    if (error) throw error;
  }
}

export async function loadItems(client: SupabaseClient | null): Promise<ItemMetric[]> {
  if (!client) return readLocal<ItemMetric>(ITEM_KEY);
  const { data, error } = await client.from("item_metrics").select("*").order("metric_date");
  if (error) throw error;
  return (data ?? []) as ItemMetric[];
}

export async function saveItems(client: SupabaseClient | null, rows: ItemMetric[]): Promise<void> {
  if (!client) {
    const mapped = new Map(readLocal<ItemMetric>(ITEM_KEY).map((row) => [`${row.metric_date}:${row.option_id}`, row]));
    rows.forEach((row) => mapped.set(`${row.metric_date}:${row.option_id}`, row));
    saveLocal(ITEM_KEY, [...mapped.values()]);
    return;
  }
  for (const group of chunks(rows)) {
    const { error } = await client.from("item_metrics").upsert(group, { onConflict: "user_id,metric_date,option_id" });
    if (error) throw error;
  }
}

export async function loadConversations(client: SupabaseClient | null): Promise<Conversation[]> {
  if (!client) return readLocal<Conversation>(CONVERSATION_KEY);
  const { data, error } = await client.from("conversations").select("*").order("conversation_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function saveConversation(client: SupabaseClient | null, conversation: Conversation): Promise<void> {
  if (!client) {
    const values = readLocal<Conversation>(CONVERSATION_KEY);
    const saved = { ...conversation, id: conversation.id ?? crypto.randomUUID(), created_at: new Date().toISOString() };
    const index = values.findIndex((entry) => entry.id === saved.id);
    if (index >= 0) values[index] = saved;
    else values.unshift(saved);
    saveLocal(CONVERSATION_KEY, values);
    return;
  }
  const { error } = await client.from("conversations").upsert(conversation).select();
  if (error) throw error;
}

export async function clearAnalyticsData(client: SupabaseClient | null): Promise<void> {
  if (!client) {
    localStorage.removeItem(DAILY_KEY);
    localStorage.removeItem(ITEM_KEY);
    return;
  }
  const { error: dailyError } = await client.from("daily_metrics").delete().gte("metric_date", "1900-01-01");
  if (dailyError) throw dailyError;
  const { error: itemsError } = await client.from("item_metrics").delete().gte("metric_date", "1900-01-01");
  if (itemsError) throw itemsError;
}
