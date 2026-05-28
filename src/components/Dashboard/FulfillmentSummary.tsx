import { useState } from "react";
import type { ItemMetric } from "../../types";
import { downloadXlsx } from "../../lib/excel";
import { compareSort, number, pivotValue, type SortDirection } from "../../lib/analyticsHelper";
import SortHeader from "../Common/SortHeader";

interface FulfillmentSummaryProps {
  items: ItemMetric[];
}

export default function FulfillmentSummary({ items }: FulfillmentSummaryProps) {
  const [sortKey, setSortKey] = useState<
    | "fulfillment"
    | "options"
    | "views"
    | "revenue"
    | "revenueShare"
    | "units"
    | "unitShare"
    | "conversion"
    | "cancellation"
    | "risks"
  >("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const totalRevenue = pivotValue(items, "revenue");
  const totalUnits = pivotValue(items, "units_sold");

  const grouped = new Map<string, ItemMetric[]>();
  items.forEach((item) => {
    const key = item.fulfillment.trim() || "(판매방식 미지정)";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  const rows = [...grouped.entries()]
    .map(([fulfillment, values]) => {
      const byOption = new Map<string, ItemMetric[]>();
      values.forEach((item) => byOption.set(item.option_id, [...(byOption.get(item.option_id) ?? []), item]));
      
      const risks = [...byOption.values()].filter(
        (optionRows) => pivotValue(optionRows, "views") > 0 && pivotValue(optionRows, "winner_rate") < 100
      ).length;
      
      const revenue = pivotValue(values, "revenue");
      const units = pivotValue(values, "units_sold");
      const views = pivotValue(values, "views");
      
      return {
        fulfillment,
        options: byOption.size,
        views,
        revenue,
        revenueShare: totalRevenue ? (revenue / totalRevenue) * 100 : 0,
        units,
        unitShare: totalUnits ? (units / totalUnits) * 100 : 0,
        conversion: pivotValue(values, "conversion_rate"),
        cancellation: pivotValue(values, "cancellation_rate"),
        risks,
      };
    })
    .sort((left, right) => compareSort(left[sortKey], right[sortKey], sortDirection));

  function changeSort(nextKey: typeof sortKey) {
    setSortDirection(sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc");
    setSortKey(nextKey);
  }

  async function exportFulfillment() {
    await downloadXlsx(
      [
        [
          "판매방식",
          "옵션 수",
          "조회수",
          "순 판매 금액(원)",
          "매출 비중(%)",
          "판매량",
          "수량 비중(%)",
          "구매전환율(%)",
          "취소율(%)",
          "아이템위너 100% 미만 옵션",
        ],
        ...rows.map((row) => [
          row.fulfillment,
          row.options,
          row.views,
          row.revenue,
          Number(row.revenueShare.toFixed(2)),
          row.units,
          Number(row.unitShare.toFixed(2)),
          Number(row.conversion.toFixed(2)),
          Number(row.cancellation.toFixed(2)),
          row.risks,
        ]),
      ],
      "coupang-fulfillment-summary.xlsx",
    );
  }

  return (
    <section className="dashboard-card fulfillment-card">
      <div className="section-head">
        <div>
          <h2>판매방식별 요약</h2>
          <p className="section-description">판매자배송과 로켓그로스의 성과 및 아이템위너 위험을 비교합니다.</p>
        </div>
        <button type="button" className="export" onClick={exportFulfillment}>
          엑셀 다운로드
        </button>
      </div>
      {!rows.length ? (
        <div className="empty">상품별 파일을 업로드하면 판매방식별 요약이 표시됩니다.</div>
      ) : (
        <div className="performance-table compact-table">
          <table>
            <thead>
              <tr>
                <SortHeader
                  label="판매방식"
                  active={sortKey === "fulfillment"}
                  direction={sortDirection}
                  onClick={() => changeSort("fulfillment")}
                />
                <SortHeader
                  label="옵션 수"
                  active={sortKey === "options"}
                  direction={sortDirection}
                  onClick={() => changeSort("options")}
                />
                <SortHeader
                  label="조회수"
                  active={sortKey === "views"}
                  direction={sortDirection}
                  onClick={() => changeSort("views")}
                />
                <SortHeader
                  label="순 판매 금액"
                  active={sortKey === "revenue"}
                  direction={sortDirection}
                  onClick={() => changeSort("revenue")}
                />
                <SortHeader
                  label="매출 비중"
                  active={sortKey === "revenueShare"}
                  direction={sortDirection}
                  onClick={() => changeSort("revenueShare")}
                />
                <SortHeader
                  label="판매량"
                  active={sortKey === "units"}
                  direction={sortDirection}
                  onClick={() => changeSort("units")}
                />
                <SortHeader
                  label="수량 비중"
                  active={sortKey === "unitShare"}
                  direction={sortDirection}
                  onClick={() => changeSort("unitShare")}
                />
                <SortHeader
                  label="구매전환율"
                  active={sortKey === "conversion"}
                  direction={sortDirection}
                  onClick={() => changeSort("conversion")}
                />
                <SortHeader
                  label="취소율"
                  active={sortKey === "cancellation"}
                  direction={sortDirection}
                  onClick={() => changeSort("cancellation")}
                />
                <SortHeader
                  label="위너 위험"
                  active={sortKey === "risks"}
                  direction={sortDirection}
                  onClick={() => changeSort("risks")}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.fulfillment}>
                  <td className="fulfillment-name">{row.fulfillment}</td>
                  <td>{number(row.options)}</td>
                  <td>{number(row.views)}회</td>
                  <td className="value-blue">{number(row.revenue)}원</td>
                  <td>
                    <div className="inline-share">
                      <i style={{ width: `${Math.max(2, row.revenueShare * 0.6)}px` }} />
                      <span>{row.revenueShare.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>{number(row.units)}개</td>
                  <td>{row.unitShare.toFixed(1)}%</td>
                  <td>{row.conversion.toFixed(2)}%</td>
                  <td>{row.cancellation.toFixed(2)}%</td>
                  <td>
                    <span className={`risk-count ${row.risks ? "danger" : "safe"}`}>
                      {number(row.risks)}개
                    </span>
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
