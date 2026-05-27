import { useState, useMemo, UIEvent } from "react";
import type { ItemMetric, PivotMetricKey } from "../../types";
import { downloadXlsx } from "../../lib/excel";
import {
  compareSort,
  displayMetric,
  metricLabels,
  number,
  pivotValue,
  type SortDirection,
} from "../../lib/analyticsHelper";
import KpiCards from "../Dashboard/KpiCards";
import SortHeader from "../Common/SortHeader";

interface PivotPanelProps {
  items: ItemMetric[];
  onSelect: (optionId: string) => void;
}

type GroupKey = "product_name" | "option_name";

export default function PivotPanel({ items, onSelect }: PivotPanelProps) {
  const [metric, setMetric] = useState<PivotMetricKey>("revenue");
  const [groupKey, setGroupKey] = useState<GroupKey>("option_name");
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // 가상 스크롤 상태 정의
  const [scrollTop, setScrollTop] = useState(0);
  const containerHeight = 420; // 뷰포트 높이
  const rowHeight = 46; // styles.css 상 td 패딩(13px*2) + 폰트(12px) = 약 46px

  const dates = useMemo(() => [...new Set(items.map((item) => item.metric_date))].sort(), [items]);
  const visibleDates = dates;
  const selectedItems = items;

  const rows = useMemo(() => {
    const grouped = new Map<string, Map<string, ItemMetric[]>>();
    for (const item of selectedItems) {
      const label = item[groupKey] || "(상품명 없음)";
      const values = grouped.get(label) ?? new Map<string, ItemMetric[]>();
      const dateRows = values.get(item.metric_date) ?? [];
      dateRows.push(item);
      values.set(item.metric_date, dateRows);
      grouped.set(label, values);
    }
    return [...grouped.entries()]
      .map(([label, dateRows]) => {
        const values = Object.fromEntries(
          visibleDates.map((date) => [date, pivotValue(dateRows.get(date) ?? [], metric)])
        );
        const allRows = visibleDates.flatMap((date) => dateRows.get(date) ?? []);
        const identity = allRows[0];
        const dailyAverage = visibleDates.length
          ? visibleDates.reduce((total, date) => total + values[date], 0) / visibleDates.length
          : 0;
        return {
          label,
          optionId: identity?.option_id ?? "",
          productId: identity?.registered_product_id ?? "",
          values,
          total: pivotValue(allRows, metric),
          dailyAverage,
        };
      })
      .sort((left, right) => {
        const leftValue = sortKey.startsWith("date:")
          ? left.values[sortKey.slice(5)]
          : left[sortKey as "label" | "optionId" | "productId" | "total" | "dailyAverage"];
        const rightValue = sortKey.startsWith("date:")
          ? right.values[sortKey.slice(5)]
          : right[sortKey as "label" | "optionId" | "productId" | "total" | "dailyAverage"];
        return compareSort(leftValue ?? 0, rightValue ?? 0, sortDirection);
      });
  }, [selectedItems, groupKey, metric, sortDirection, sortKey, visibleDates]);

  const isRatioMetric = metric === "conversion_rate" || metric === "winner_rate" || metric === "cancellation_rate";
  const isCancellationMetric =
    metric === "cancel_amount" ||
    metric === "cancelled_units" ||
    metric === "immediately_cancelled_units" ||
    metric === "cancellation_rate";

  const dailyTotals = Object.fromEntries(
    visibleDates.map((date) => [date, pivotValue(selectedItems.filter((item) => item.metric_date === date), metric)])
  );
  const periodTotal = pivotValue(selectedItems, metric);
  const periodDailyAverage = visibleDates.length
    ? visibleDates.reduce((total, date) => total + dailyTotals[date], 0) / visibleDates.length
    : 0;

  function changeSort(nextKey: string) {
    setSortDirection(sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc");
    setSortKey(nextKey);
  }

  async function exportPivot() {
    const columns = ["상품ID", "옵션ID", "상품/옵션", ...visibleDates, isRatioMetric ? "기간값" : "합계", "일평균"];
    await downloadXlsx(
      [
        columns,
        ["", "", "일별 합계", ...visibleDates.map((date) => dailyTotals[date] ?? 0), periodTotal, periodDailyAverage],
        ...rows.map((row) => [
          row.productId,
          row.optionId,
          row.label,
          ...visibleDates.map((date) => row.values[date] ?? 0),
          row.total,
          row.dailyAverage,
        ]),
      ],
      "coupang-pivot.xlsx",
    );
  }

  // 가상화 스크롤 이벤트 핸들러
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  // 렌더링 범위 인덱스 연산 (상/하단 3개씩 버퍼 배치)
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / rowHeight) + 3);
  
  const visibleRows = rows.slice(startIndex, endIndex);
  const totalColumns = 3 + visibleDates.length + 2; // 전체 td 갯수

  return (
    <>
      <KpiCards items={selectedItems} />
      <section className="dashboard-card pivot-card">
        <div className="section-head pivot-head">
          <h2>▤ 직관적인 피벗 (Pivot)</h2>
          <div className="pivot-controls">
            <label>
              지표
              <select value={metric} onChange={(event) => setMetric(event.target.value as PivotMetricKey)}>
                {Object.entries(metricLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              행 기준
              <select value={groupKey} onChange={(event) => setGroupKey(event.target.value as GroupKey)}>
                <option value="product_name">상품명</option>
                <option value="option_name">옵션명</option>
              </select>
            </label>
            <button type="button" className="export" onClick={exportPivot}>
              피벗 엑셀 다운로드
            </button>
          </div>
        </div>

        {!dates.length ? (
          <div className="empty">
            아직 상품 지표가 없습니다. <b>엑셀 가져오기</b>에서 일별 요약 파일과 상품별 파일을 올려주세요.
          </div>
        ) : (
          /* 가상화를 위해 고정 높이와 overflowY 지정을 감싸는 컨테이너 생성 */
          <div
            className="table-wrap"
            onScroll={handleScroll}
            style={{ maxHeight: `${containerHeight}px`, overflowY: "auto", position: "relative" }}
          >
            <table className="pivot-table">
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
                    label={groupKey === "product_name" ? "상품명" : "옵션명"}
                    active={sortKey === "label"}
                    direction={sortDirection}
                    onClick={() => changeSort("label")}
                    className="sticky"
                  />
                  {visibleDates.map((date) => (
                    <SortHeader
                      key={date}
                      label={date}
                      active={sortKey === `date:${date}`}
                      direction={sortDirection}
                      onClick={() => changeSort(`date:${date}`)}
                    />
                  ))}
                  <SortHeader
                    label={isRatioMetric ? "기간값" : "합계"}
                    active={sortKey === "total"}
                    direction={sortDirection}
                    onClick={() => changeSort("total")}
                  />
                  <SortHeader
                    label="일평균"
                    active={sortKey === "dailyAverage"}
                    direction={sortDirection}
                    onClick={() => changeSort("dailyAverage")}
                  />
                </tr>
              </thead>
              <tbody>
                {/* 상단 일별 합계 (항상 가시권에 두기 위해 첫번째 Row에 배치) */}
                <tr className="summary-row">
                  <td />
                  <td />
                  <td className="sticky">일별 합계</td>
                  {visibleDates.map((date) => (
                    <td key={date}>{displayMetric(dailyTotals[date] ?? 0, metric)}</td>
                  ))}
                  <td className="total">{displayMetric(periodTotal, metric)}</td>
                  <td className="total">{displayMetric(periodDailyAverage, metric)}</td>
                </tr>

                {/* 상단 가상 높이 보전용 Row */}
                {startIndex > 0 && (
                  <tr style={{ height: `${startIndex * rowHeight}px` }}>
                    <td colSpan={totalColumns} style={{ padding: 0, height: `${startIndex * rowHeight}px` }} />
                  </tr>
                )}

                {/* 실제 브라우저 화면에 보이는 Row 목록 */}
                {visibleRows.map((row) => (
                  <tr key={row.label} onClick={() => onSelect(row.optionId)}>
                    <td>{row.productId}</td>
                    <td>{row.optionId}</td>
                    <td className="sticky" title={row.label}>
                      {row.label}
                    </td>
                    {visibleDates.map((date) => (
                      <td key={date}>{displayMetric(row.values[date] ?? 0, metric)}</td>
                    ))}
                    <td className="total">{displayMetric(row.total, metric)}</td>
                    <td className="total">{displayMetric(row.dailyAverage, metric)}</td>
                  </tr>
                ))}

                {/* 하단 가상 높이 보전용 Row */}
                {rows.length > endIndex && (
                  <tr style={{ height: `${(rows.length - endIndex) * rowHeight}px` }}>
                    <td colSpan={totalColumns} style={{ padding: 0, height: `${(rows.length - endIndex) * rowHeight}px` }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="caption">전체 {number(rows.length)}개 행을 표시합니다. 일평균은 조회 기간의 날짜 수를 기준으로 계산합니다.</p>
        {isRatioMetric && (
          <p className="caption">
            {metric === "conversion_rate" && "구매전환율은 주문 / 조회로 계산합니다."}
            {metric === "winner_rate" && "아이템위너 비율은 조회수 기준 가중평균입니다."}
            {metric === "cancellation_rate" && "취소율은 총 취소 상품수 / 총 판매수로 계산합니다."}
          </p>
        )}
        {isCancellationMetric && (
          <p className="caption">취소 관련 값은 원본 파일의 음수 부호를 제거하고 취소 규모로 표시합니다.</p>
        )}
      </section>
    </>
  );
}
