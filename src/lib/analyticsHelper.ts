import type { ItemMetric, PivotMetricKey } from "../types";

export type SortDirection = "asc" | "desc";

export const metricLabels: Record<PivotMetricKey, string> = {
  revenue: "매출",
  units_sold: "판매량",
  orders: "주문",
  visitors: "방문자",
  views: "조회",
  carts: "장바구니",
  conversion_rate: "구매전환율",
  winner_rate: "아이템위너 비율",
  gross_revenue: "총 매출",
  gross_units: "총 판매수",
  cancel_amount: "총 취소 금액",
  cancelled_units: "총 취소 상품수",
  immediately_cancelled_units: "즉시 취소 상품수",
  cancellation_rate: "취소율",
};

export function number(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function percentValue(value: string): number {
  return Number(value.replace("%", "").trim()) || 0;
}

export function pivotValue(rows: ItemMetric[], metric: PivotMetricKey): number {
  switch (metric) {
    case "conversion_rate": {
      const views = rows.reduce((total, row) => total + row.views, 0);
      const orders = rows.reduce((total, row) => total + row.orders, 0);
      return views ? (orders / views) * 100 : 0;
    }
    case "winner_rate": {
      const weightedRows = rows.filter((row) => row.views > 0);
      const views = weightedRows.reduce((total, row) => total + row.views, 0);
      if (views) return weightedRows.reduce((total, row) => total + percentValue(row.winner_rate) * row.views, 0) / views;
      return rows.length ? rows.reduce((total, row) => total + percentValue(row.winner_rate), 0) / rows.length : 0;
    }
    case "cancellation_rate": {
      const grossUnits = rows.reduce((total, row) => total + row.gross_units, 0);
      const cancelledUnits = rows.reduce((total, row) => total + Math.abs(row.cancelled_units), 0);
      return grossUnits ? (cancelledUnits / grossUnits) * 100 : 0;
    }
    case "cancel_amount":
      return rows.reduce((total, row) => total + Math.abs(row.cancel_amount), 0);
    case "cancelled_units":
      return rows.reduce((total, row) => total + Math.abs(row.cancelled_units), 0);
    case "immediately_cancelled_units":
      return rows.reduce((total, row) => total + Math.abs(row.immediately_cancelled_units), 0);
    default:
      return rows.reduce((total, row) => total + (row[metric] as number), 0);
  }
}

export function displayMetric(value: number, metric: PivotMetricKey): string {
  if (metric === "revenue" || metric === "gross_revenue" || metric === "cancel_amount") return `${number(value)}원`;
  if (metric === "conversion_rate" || metric === "winner_rate" || metric === "cancellation_rate") return `${value.toFixed(2)}%`;
  return number(value);
}

export function compareSort(left: string | number, right: string | number, direction: SortDirection): number {
  const compared = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), "ko");
  return direction === "asc" ? compared : -compared;
}

export function buildTrendSeries(daily: any[], items: ItemMetric[], useItems: boolean): TrendPoint[] {
  if (!useItems && daily.length) return daily.map((row) => ({
    date: row.metric_date, revenue: row.revenue, units: row.units_sold, orders: row.orders, views: row.views,
    conversion: row.views ? (row.orders / row.views) * 100 : 0, winner: 0,
  }));
  const map = new Map<string, ItemMetric[]>();
  items.forEach((item) => map.set(item.metric_date, [...(map.get(item.metric_date) ?? []), item]));
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, rows]) => ({
    date, revenue: pivotValue(rows, "revenue"), units: pivotValue(rows, "units_sold"),
    orders: pivotValue(rows, "orders"), views: pivotValue(rows, "views"), conversion: pivotValue(rows, "conversion_rate"),
    winner: pivotValue(rows, "winner_rate"),
  }));
}

import { type TrendPoint } from "../types";
