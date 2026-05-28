import { useState } from "react";
import type { ItemMetric } from "../../types";
import { downloadXlsx } from "../../lib/excel";
import { compareSort, number, pivotValue, type SortDirection } from "../../lib/analyticsHelper";
import KpiCards from "../Dashboard/KpiCards";

interface CategoryPanelProps {
  items: ItemMetric[];
}

export default function CategoryPanel({ items }: CategoryPanelProps) {
  const [basis, setBasis] = useState<"revenue" | "units">("revenue");
  const [sortKey, setSortKey] = useState<"category" | "revenue" | "units">("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const revenueTotal = pivotValue(items, "revenue");
  const unitsTotal = pivotValue(items, "units_sold");

  const categories = [
    ...items.reduce((map, item) => {
      const key = item.category || "(미분류)";
      map.set(key, [...(map.get(key) ?? []), item]);
      return map;
    }, new Map<string, ItemMetric[]>()).entries(),
  ]
    .map(([category, rows]) => ({
      category,
      revenue: pivotValue(rows, "revenue"),
      units: pivotValue(rows, "units_sold"),
    }))
    .sort((left, right) => compareSort(left[sortKey], right[sortKey], sortDirection));

  function selectBasis(nextBasis: "revenue" | "units") {
    setBasis(nextBasis);
    if (sortKey === nextBasis) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
      return;
    }
    setSortKey(nextBasis);
    setSortDirection("desc");
  }

  function changeSort(nextKey: "category" | "revenue" | "units") {
    setSortDirection(sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc");
    setSortKey(nextKey);
  }

  async function exportCategories() {
    await downloadXlsx(
      [
        ["카테고리", "판매량", "수량 비중(%)", "매출(원)", "매출 비중(%)"],
        ...categories.map((row) => [
          row.category,
          row.units,
          Number((unitsTotal ? (row.units / unitsTotal) * 100 : 0).toFixed(2)),
          row.revenue,
          Number((revenueTotal ? (row.revenue / revenueTotal) * 100 : 0).toFixed(2)),
        ]),
      ],
      "coupang-categories.xlsx",
    );
  }

  return (
    <>
      <KpiCards items={items} />
      <section className="dashboard-card category-card">
        <div className="section-head">
          <h2>◔ 카테고리 비중</h2>
          <div className="section-actions">
            <div className="segmented">
              <button
                type="button"
                className={basis === "revenue" ? "active" : ""}
                onClick={() => selectBasis("revenue")}
              >
                매출 비중
              </button>
              <button
                type="button"
                className={basis === "units" ? "active" : ""}
                onClick={() => selectBasis("units")}
              >
                수량 비중
              </button>
              <button type="button" onClick={() => changeSort("category")}>
                이름 {sortKey === "category" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
              </button>
            </div>
            <button type="button" className="export" onClick={exportCategories}>
              엑셀 다운로드
            </button>
          </div>
        </div>
        {!categories.length ? (
          <div className="empty">상품 파일을 업로드하면 카테고리별 매출 비중이 표시됩니다.</div>
        ) : (
          categories.map((row) => (
            <div className="category-row" key={row.category}>
              <div>
                <b>{row.category}</b>
                <span>{number(row.units)}개</span>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${
                      basis === "revenue"
                        ? revenueTotal
                          ? (row.revenue / revenueTotal) * 100
                          : 0
                        : unitsTotal
                        ? (row.units / unitsTotal) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <strong>
                {basis === "revenue" ? `${number(row.revenue)}원` : `${number(row.units)}개`}
              </strong>
              <em>
                {basis === "revenue"
                  ? revenueTotal
                    ? ((row.revenue / revenueTotal) * 100).toFixed(1)
                    : "0.0"
                  : unitsTotal
                  ? ((row.units / unitsTotal) * 100).toFixed(1)
                  : "0.0"}
                %
              </em>
            </div>
          ))
        )}
      </section>
    </>
  );
}
