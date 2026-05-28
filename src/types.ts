export type MatchingMetricKey = "revenue" | "units_sold" | "orders" | "visitors" | "views" | "carts";

export type PivotMetricKey =
  | MatchingMetricKey
  | "conversion_rate"
  | "winner_rate"
  | "gross_revenue"
  | "gross_units"
  | "cancel_amount"
  | "cancelled_units"
  | "immediately_cancelled_units"
  | "cancellation_rate";

export interface DailyMetric {
  metric_date: string;
  visitors: number;
  views: number;
  carts: number;
  orders: number;
  conversion_rate: string;
  units_sold: number;
  revenue: number;
  source_file: string;
}

export interface ItemMetric {
  metric_date: string;
  option_id: string;
  option_name: string;
  product_name: string;
  registered_product_id: string;
  category: string;
  fulfillment: string;
  revenue: number;
  orders: number;
  units_sold: number;
  visitors: number;
  views: number;
  carts: number;
  conversion_rate: string;
  winner_rate: string;
  gross_revenue: number;
  gross_units: number;
  cancel_amount: number;
  cancelled_units: number;
  immediately_cancelled_units: number;
  source_file: string;
}

export interface VendorImport {
  source_file: string;
  rows: Omit<ItemMetric, "metric_date">[];
  totals: Pick<ItemMetric, MatchingMetricKey>;
  matched_date: string | null;
}

export interface Conversation {
  id?: string;
  title: string;
  conversation_date: string;
  html_content: string;
  plain_text: string;
  created_at?: string;
}

export type View = "dashboard" | "trend" | "categories" | "winner" | "pivot" | "products" | "import" | "setup";
export type ChartMetric = "views" | "units" | "revenue" | "conversion" | "winner";

export interface TrendPoint {
  date: string;
  revenue: number;
  units: number;
  orders: number;
  views: number;
  conversion: number;
  winner: number;
}
