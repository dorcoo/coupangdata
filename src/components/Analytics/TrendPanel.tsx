import type { ItemMetric, TrendPoint } from "../../types";
import { buildTrendSeries } from "../../lib/analyticsHelper";
import KpiCards from "../Dashboard/KpiCards";
import LineChart from "../Common/LineChart";

interface TrendPanelProps {
  series: TrendPoint[];
  items: ItemMetric[];
}

export default function TrendPanel({ series, items }: TrendPanelProps) {
  const itemSeries = buildTrendSeries([], items, true);

  return (
    <>
      <KpiCards items={items} series={series} />
      <section className="dashboard-card">
        <div className="section-head">
          <h2>일별/월별 추이</h2>
        </div>
        <LineChart
          points={series}
          value={(row) => row.revenue}
          label="일별 매출"
          color="#2563eb"
          suffix="원"
          fill
        />
      </section>
      <section className="chart-grid">
        <div className="dashboard-card">
          <h3>판매량 추이</h3>
          <LineChart points={series} value={(row) => row.units} label="판매량" color="#10b981" suffix="개" />
        </div>
        <div className="dashboard-card">
          <h3>구매전환율 추이</h3>
          <LineChart points={series} value={(row) => row.conversion} label="전환율" color="#f59e0b" suffix="%" />
        </div>
        <div className="dashboard-card winner-chart">
          <h3>아이템위너 비율 추이</h3>
          <LineChart points={itemSeries} value={(row) => row.winner} label="아이템위너" color="#ef4444" suffix="%" />
        </div>
      </section>
    </>
  );
}
