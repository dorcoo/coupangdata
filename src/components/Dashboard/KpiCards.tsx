import type { ItemMetric } from "../../types";
import type { TrendPoint } from "../../types";
import { number, pivotValue } from "../../lib/analyticsHelper";

interface KpiCardsProps {
  items: ItemMetric[];
  series?: TrendPoint[];
}

export default function KpiCards({ items, series = [] }: KpiCardsProps) {
  const revenue = series.length ? series.reduce((total, point) => total + point.revenue, 0) : pivotValue(items, "revenue");
  const units = series.length ? series.reduce((total, point) => total + point.units, 0) : pivotValue(items, "units_sold");
  const cancel = pivotValue(items, "cancel_amount");
  const cancellationRate = pivotValue(items, "cancellation_rate");

  return (
    <div className="kpi-grid">
      <article className="kpi blue">
        <span>총 순 판매 금액</span>
        <strong>
          {number(revenue)} <small>원</small>
        </strong>
      </article>
      <article className="kpi green">
        <span>총 판매 상품 수</span>
        <strong>
          {number(units)} <small>개</small>
        </strong>
      </article>
      <article className="kpi red">
        <span>총 취소 금액</span>
        <strong>
          {number(cancel)} <small>원</small>
        </strong>
      </article>
      <article className="kpi orange">
        <span>취소율 (수량 기준)</span>
        <strong>
          {cancellationRate.toFixed(1)} <small>%</small>
        </strong>
      </article>
    </div>
  );
}
