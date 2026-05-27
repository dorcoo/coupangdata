import { useState } from "react";
import type { ItemMetric } from "../../types";
import { downloadXlsx } from "../../lib/excel";
import { compareSort, number, pivotValue, type SortDirection } from "../../lib/analyticsHelper";
import SortHeader from "../Common/SortHeader";
import WinnerBadge from "../Common/WinnerBadge";

interface ProductsPanelProps {
  items: ItemMetric[];
  onSelect: (optionId: string) => void;
  compact?: boolean;
}

export default function ProductsPanel({
  items,
  onSelect,
  compact = false,
}: ProductsPanelProps) {
  const [sortKey, setSortKey] = useState<
    "productId" | "optionId" | "name" | "units" | "unitShare" | "revenue" | "revenueShare" | "conversion" | "winner"
  >("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const totalUnits = pivotValue(items, "units_sold");
  const totalRevenue = pivotValue(items, "revenue");

  const grouped = new Map<string, ItemMetric[]>();
  items.forEach((item) => grouped.set(item.option_id, [...(grouped.get(item.option_id) ?? []), item]));

  const rows = [...grouped.entries()]
    .map(([optionId, values]) => ({
      optionId,
      name: values[0].option_name,
      productId: values[0].registered_product_id,
      units: pivotValue(values, "units_sold"),
      revenue: pivotValue(values, "revenue"),
      unitShare: totalUnits ? (pivotValue(values, "units_sold") / totalUnits) * 100 : 0,
      revenueShare: totalRevenue ? (pivotValue(values, "revenue") / totalRevenue) * 100 : 0,
      conversion: pivotValue(values, "conversion_rate"),
      winner: pivotValue(values, "winner_rate"),
    }))
    .sort((left, right) => compareSort(left[sortKey], right[sortKey], sortDirection));

  function changeSort(nextKey: typeof sortKey) {
    setSortDirection(sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc");
    setSortKey(nextKey);
  }

  async function exportProducts() {
    await downloadXlsx(
      [
        ["상품ID", "옵션ID", "옵션명", "수량", "수량 비중(%)", "매출(원)", "매출 비중(%)", "전환율(%)", "아이템위너 비율(%)"],
        ...rows.map((row) => [
          row.productId,
          row.optionId,
          row.name,
          row.units,
          Number(row.unitShare.toFixed(2)),
          row.revenue,
          Number(row.revenueShare.toFixed(2)),
          Number(row.conversion.toFixed(2)),
          Number(row.winner.toFixed(2)),
        ]),
      ],
      "coupang-product-performance.xlsx",
    );
  }

  return (
    <section className="dashboard-card product-card">
      <div className="section-head">
        <h2>
          ☷ {compact ? "세부 데이터 내역" : "상품/옵션 실적"}{" "}
          <small className="row-count">{number(rows.length)}건</small>
        </h2>
        <button type="button" className="export" onClick={exportProducts}>
          엑셀 다운로드
        </button>
      </div>
      {!rows.length ? (
        <div className="empty">상품 파일을 업로드하면 실적 목록과 상세 추이가 표시됩니다.</div>
      ) : (
        <div className="performance-table">
          <table>
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
                  label="수량"
                  active={sortKey === "units"}
                  direction={sortDirection}
                  onClick={() => changeSort("units")}
                />
                <SortHeader
                  label="수량비중"
                  active={sortKey === "unitShare"}
                  direction={sortDirection}
                  onClick={() => changeSort("unitShare")}
                />
                <SortHeader
                  label="매출"
                  active={sortKey === "revenue"}
                  direction={sortDirection}
                  onClick={() => changeSort("revenue")}
                />
                <SortHeader
                  label="매출비중"
                  active={sortKey === "revenueShare"}
                  direction={sortDirection}
                  onClick={() => changeSort("revenueShare")}
                />
                <SortHeader
                  label="전환율"
                  active={sortKey === "conversion"}
                  direction={sortDirection}
                  onClick={() => changeSort("conversion")}
                />
                <SortHeader
                  label="아이템위너"
                  active={sortKey === "winner"}
                  direction={sortDirection}
                  onClick={() => changeSort("winner")}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.optionId} onClick={() => onSelect(row.optionId)}>
                  <td>{row.productId}</td>
                  <td>{row.optionId}</td>
                  <td>{row.name}</td>
                  <td>{number(row.units)}</td>
                  <td>{row.unitShare.toFixed(1)}%</td>
                  <td className="value-blue">{number(row.revenue)}원</td>
                  <td>{row.revenueShare.toFixed(1)}%</td>
                  <td>{row.conversion.toFixed(2)}%</td>
                  <td>
                    <WinnerBadge value={row.winner} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export type { ProductsPanelProps };
