import { useState } from "react";
import type { ItemMetric } from "../../types";
import { downloadXlsx } from "../../lib/excel";
import { compareSort, number, pivotValue, type SortDirection } from "../../lib/analyticsHelper";
import SortHeader from "../Common/SortHeader";
import WinnerBadge from "../Common/WinnerBadge";

interface WinnerRiskPanelProps {
  items: ItemMetric[];
  onSelect: (optionId: string) => void;
}

export default function WinnerRiskPanel({ items, onSelect }: WinnerRiskPanelProps) {
  const [filter, setFilter] = useState<"all" | "danger" | "zero">("all");
  const [sortKey, setSortKey] = useState<"productId" | "optionId" | "name" | "winner" | "views" | "units" | "revenue">("winner");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const grouped = new Map<string, ItemMetric[]>();
  items
    .filter((item) => item.views > 0)
    .forEach((item) => grouped.set(item.option_id, [...(grouped.get(item.option_id) ?? []), item]));

  const rows = [...grouped.entries()]
    .map(([optionId, values]) => ({
      optionId,
      name: values[0].option_name,
      productId: values[0].registered_product_id,
      winner: pivotValue(values, "winner_rate"),
      views: pivotValue(values, "views"),
      revenue: pivotValue(values, "revenue"),
      units: pivotValue(values, "units_sold"),
    }))
    .filter((row) => row.winner < 100);

  const visible = rows
    .filter((row) => filter === "all" || (filter === "danger" ? row.winner < 90 : row.winner === 0))
    .sort((left, right) => compareSort(left[sortKey], right[sortKey], sortDirection));

  const under90 = rows.filter((row) => row.winner < 90).length;
  const zero = rows.filter((row) => row.winner === 0).length;
  const affectedRevenue = rows.reduce((total, row) => total + row.revenue, 0);

  function changeSort(nextKey: typeof sortKey) {
    setSortDirection(sortKey === nextKey && sortDirection === "asc" ? "desc" : "asc");
    setSortKey(nextKey);
  }

  async function exportRisks() {
    await downloadXlsx(
      [
        ["상품ID", "옵션ID", "옵션명", "아이템위너 비율(%)", "조회", "판매량", "매출(원)"],
        ...visible.map((row) => [
          row.productId,
          row.optionId,
          row.name,
          Number(row.winner.toFixed(2)),
          row.views,
          row.units,
          row.revenue,
        ]),
      ],
      "coupang-itemwinner-risks.xlsx",
    );
  }

  return (
    <>
      <section className="risk-banner">
        <div>
          <h2>아이템위너 위험 모니터</h2>
          <p>아이템위너 비율이 100%가 아닌 상품은 노출과 판매 기회를 잃을 수 있습니다.</p>
        </div>
        <span className="danger-callout">확인 필요 {number(rows.length)}개</span>
      </section>
      <div className="risk-grid">
        <article>
          <span>100% 미만 옵션</span>
          <strong>{number(rows.length)}</strong>
        </article>
        <article className="warn">
          <span>90% 미만 위험 옵션</span>
          <strong>{number(under90)}</strong>
        </article>
        <article className="critical">
          <span>아이템위너 0% 옵션</span>
          <strong>{number(zero)}</strong>
        </article>
        <article>
          <span>영향 매출</span>
          <strong>{number(affectedRevenue)}원</strong>
        </article>
      </div>
      <section className="dashboard-card">
        <div className="section-head">
          <h2>
            위험 상품 목록 <small className="row-count">{number(visible.length)}건</small>
          </h2>
          <div className="section-actions">
            <div className="segmented">
              <button
                type="button"
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                100% 미만
              </button>
              <button
                type="button"
                className={filter === "danger" ? "active" : ""}
                onClick={() => setFilter("danger")}
              >
                90% 미만
              </button>
              <button
                type="button"
                className={filter === "zero" ? "active" : ""}
                onClick={() => setFilter("zero")}
              >
                0%만
              </button>
            </div>
            <button type="button" className="export" onClick={exportRisks}>
              엑셀 다운로드
            </button>
          </div>
        </div>
        {!visible.length ? (
          <div className="empty">선택한 기준에 해당하는 위험 옵션이 없습니다.</div>
        ) : (
          <div className="performance-table">
            <table className="risk-table">
              <thead>
                <tr>
                  <SortHeader
                    label="상품ID"
                    active={sortKey === "productId"}
                    direction={sortDirection}
                    onClick={() => changeSort("productId")}
                  />
                  <SortHeader
                    label="옵션ID"
                    active={sortKey === "optionId"}
                    direction={sortDirection}
                    onClick={() => changeSort("optionId")}
                  />
                  <SortHeader
                    label="옵션명"
                    active={sortKey === "name"}
                    direction={sortDirection}
                    onClick={() => changeSort("name")}
                  />
                  <SortHeader
                    label="아이템위너"
                    active={sortKey === "winner"}
                    direction={sortDirection}
                    onClick={() => changeSort("winner")}
                  />
                  <SortHeader
                    label="조회"
                    active={sortKey === "views"}
                    direction={sortDirection}
                    onClick={() => changeSort("views")}
                  />
                  <SortHeader
                    label="판매량"
                    active={sortKey === "units"}
                    direction={sortDirection}
                    onClick={() => changeSort("units")}
                  />
                  <SortHeader
                    label="매출"
                    active={sortKey === "revenue"}
                    direction={sortDirection}
                    onClick={() => changeSort("revenue")}
                  />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.optionId} onClick={() => onSelect(row.optionId)}>
                    <td>{row.productId}</td>
                    <td>{row.optionId}</td>
                    <td>{row.name}</td>
                    <td>
                      <WinnerBadge value={row.winner} />
                    </td>
                    <td>{number(row.views)}</td>
                    <td>{number(row.units)}</td>
                    <td className="value-blue">{number(row.revenue)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
