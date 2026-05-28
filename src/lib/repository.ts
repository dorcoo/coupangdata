import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, DailyMetric, ItemMetric } from "../types";

const DAILY_KEY = "coupang.daily_metrics";
const ITEM_KEY = "coupang.item_metrics";
const CONVERSATION_KEY = "coupang.conversations";
const SELECT_PAGE_SIZE = 1000;

function readLocal<T>(key: string): T[] {
  return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
}

function saveLocal<T>(key: string, values: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      alert(
        "로컬 브라우저 저장 용량(약 5MB)을 초과했습니다.\n\nSupabase에 로그인하여 서버 데이터베이스를 연동하시면 용량 제한 없이 대용량 데이터를 분석할 수 있습니다."
      );
    } else {
      throw error;
    }
  }
}

function chunks<T>(values: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function selectAll<T>(
  client: SupabaseClient,
  table: string,
  orderColumns: string[],
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const to = from + SELECT_PAGE_SIZE - 1;
    let query = client.from(table).select("*");
    orderColumns.forEach((column) => {
      query = query.order(column);
    });

    const { data, error } = await query.range(from, to);
    if (error) throw error;

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < SELECT_PAGE_SIZE) return rows;
  }
}

export async function loadDaily(client: SupabaseClient | null): Promise<DailyMetric[]> {
  if (!client) return readLocal<DailyMetric>(DAILY_KEY);
  return selectAll<DailyMetric>(client, "daily_metrics", ["metric_date"]);
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
  return selectAll<ItemMetric>(client, "item_metrics", ["metric_date", "option_id"]);
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
  const rows = await selectAll<Conversation>(client, "conversations", ["conversation_date"]);
  return rows.reverse();
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
