import type { ItemMetric } from "../../types";
import { downloadXlsx } from "../../lib/excel";
import { buildTrendSeries, number, pivotValue } from "../../lib/analyticsHelper";
import LineChart from "../Common/LineChart";
import WinnerBadge from "../Common/WinnerBadge";

interface ProductDetailModalProps {
  items: ItemMetric[];
  onClose: () => void;
}

export default function ProductDetailModal({
  items,
  onClose,
}: ProductDetailModalProps) {
  const option = items[0];
  const series = buildTrendSeries([], items, true);

  async function downloadDetail() {
    await downloadXlsx(
      [
        ["날짜", "조회", "판매량", "매출(원)", "구매전환율(%)", "아이템위너 비율(%)"],
        ...series.map((row) => [
          row.date,
          row.views,
          row.units,
          row.revenue,
          Number(row.conversion.toFixed(2)),
          Number(row.winner.toFixed(2)),
        ]),
      ],
      `${option.option_id}-trend.xlsx`,
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="detail-modal"
        role="dialog"
        aria-label="상품 상세 분석"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="detail-header">
          <span className="detail-icon">◉</span>
          <div>
            <h2>{option.option_name}</h2>
            <p>PRODUCT IDENTITY: {option.registered_product_id}</p>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="detail-summary">
          <span>{option.product_name}</span>
          <b>{number(pivotValue(items, "units_sold"))}회</b>
          <b>{number(pivotValue(items, "revenue"))}원</b>
          <b>{pivotValue(items, "conversion_rate").toFixed(2)}%</b>
          <WinnerBadge value={pivotValue(items, "winner_rate")} />
        </div>
        <div className="detail-title">
          <h3>상품 종합 성과 추이</h3>
          <button type="button" onClick={downloadDetail}>데이터 다운로드</button>
        </div>
        <div className="detail-charts">
          <div>
            <p>일별 유입(조회수) 변화</p>
            <LineChart points={series} value={(row) => row.views} label="조회수" color="#10b981" suffix="회" fill />
          </div>
          <div>
            <p>일별 주문 수량 추이</p>
            <LineChart points={series} value={(row) => row.units} label="판매량" color="#8b5cf6" suffix="개" />
          </div>
          <div>
            <p>일별 매출액 추이</p>
            <LineChart points={series} value={(row) => row.revenue} label="매출" color="#3b82f6" suffix="원" />
          </div>
          <div>
            <p>일별 전환율(CVR) 추이</p>
            <LineChart points={series} value={(row) => row.conversion} label="전환율" color="#f59e0b" suffix="%" />
          </div>
          <div className="winner-detail-chart">
            <p>일별 아이템위너 비율</p>
            <LineChart points={series} value={(row) => row.winner} label="아이템위너" color="#ef4444" suffix="%" />
          </div>
        </div>
      </section>
    </div>
  );
}
