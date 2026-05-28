import { useState } from "react";
import type { ItemMetric, TrendPoint, ChartMetric } from "../../types";
import { buildTrendSeries } from "../../lib/analyticsHelper";
import KpiCards from "./KpiCards";
import FulfillmentSummary from "./FulfillmentSummary";
import LineChart from "../Common/LineChart";
import ProductsPanel from "../Analytics/ProductsPanel";

interface DashboardPanelProps {
  items: ItemMetric[];
  series: TrendPoint[];
  onSelect: (optionId: string) => void;
}

export default function DashboardPanel({
  items,
  series,
  onSelect,
}: DashboardPanelProps) {
  const [metric, setMetric] = useState<ChartMetric>("units");
  const itemSeries = buildTrendSeries([], items, true);

  const options: Record<ChartMetric, { label: string; color: string; suffix: string }> = {
    views: { label: "조회수", color: "#0ea5e9", suffix: "회" },
    units: { label: "순 판매 수량", color: "#12b981", suffix: "개" },
    revenue: { label: "순 판매 금액", color: "#2563eb", suffix: "원" },
    conversion: { label: "구매전환율", color: "#f59e0b", suffix: "%" },
    winner: { label: "아이템위너 비율", color: "#ef4444", suffix: "%" },
  };

  const option = options[metric];
  const chartSeries = metric === "winner" ? itemSeries : series;

  return (
    <>
      <KpiCards items={items} series={series} />
      <FulfillmentSummary items={items} />
      <section className="dashboard-card">
        <div className="section-head">
          <h2>⌁ 데이터 분석 차트</h2>
          <div className="segmented">
            {Object.entries(options).map(([key, item]) => (
              <button
                type="button"
                className={metric === key ? "active" : ""}
                key={key}
                onClick={() => setMetric(key as ChartMetric)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <LineChart
          points={chartSeries}
          value={(row) => row[metric]}
          label={option.label}
          color={option.color}
          suffix={option.suffix}
          fill
        />
      </section>
      <ProductsPanel items={items} onSelect={onSelect} compact />
    </>
  );
}
