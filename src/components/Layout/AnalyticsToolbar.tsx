import { useEffect, useState, type KeyboardEvent } from "react";

interface AnalyticsToolbarProps {
  query: string;
  fromDate: string;
  toDate: string;
  allDates: string[];
  fulfillmentFilter: string;
  onQuery: (value: string) => void;
  onFromDate: (value: string) => void;
  onToDate: (value: string) => void;
  onFulfillmentFilter: (value: string) => void;
}

function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00`);
  shifted.setDate(shifted.getDate() + days);
  return localIsoDate(shifted);
}

function maximumReportDate(allDates: string[]): string {
  const yesterday = shiftDate(localIsoDate(new Date()), -1);
  const settledDates = allDates.filter((date) => date <= yesterday);
  return settledDates[settledDates.length - 1] ?? allDates[allDates.length - 1] ?? "";
}

export default function AnalyticsToolbar({
  query,
  fromDate,
  toDate,
  allDates,
  fulfillmentFilter,
  onQuery,
  onFromDate,
  onToDate,
  onFulfillmentFilter,
}: AnalyticsToolbarProps) {
  const maximum = maximumReportDate(allDates);
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftFromDate, setDraftFromDate] = useState(fromDate);
  const [draftToDate, setDraftToDate] = useState(toDate);
  const [draftFulfillmentFilter, setDraftFulfillmentFilter] = useState(fulfillmentFilter);

  useEffect(() => setDraftQuery(query), [query]);
  useEffect(() => setDraftFromDate(fromDate), [fromDate]);
  useEffect(() => setDraftToDate(toDate), [toDate]);
  useEffect(() => setDraftFulfillmentFilter(fulfillmentFilter), [fulfillmentFilter]);

  function applyFilters() {
    onQuery(draftQuery);
    onFromDate(draftFromDate);
    onToDate(draftToDate);
    onFulfillmentFilter(draftFulfillmentFilter);
  }

  function applySearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    applyFilters();
  }

  function period(days: number | null) {
    if (!maximum || days === null) {
      setDraftFromDate("");
      setDraftToDate("");
      return;
    }
    setDraftFromDate(shiftDate(maximum, -days + 1));
    setDraftToDate(maximum);
  }

  return (
    <div className="analytics-toolbar">
      <label className="toolbar-search">
        ⌕
        <input
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          onKeyDown={applySearch}
          placeholder="상품 또는 옵션 검색"
        />
      </label>
      <div className="segmented">
        <button
          type="button"
          className={draftFulfillmentFilter === "all" ? "active" : ""}
          onClick={() => setDraftFulfillmentFilter("all")}
        >
          전체 방식
        </button>
        <button
          type="button"
          className={draftFulfillmentFilter === "로켓그로스" ? "active" : ""}
          onClick={() => setDraftFulfillmentFilter("로켓그로스")}
        >
          로켓그로스
        </button>
        <button
          type="button"
          className={draftFulfillmentFilter === "판매자배송" ? "active" : ""}
          onClick={() => setDraftFulfillmentFilter("판매자배송")}
        >
          판매자배송
        </button>
      </div>
      <div className="periods">
        <button type="button" onClick={() => period(1)}>어제</button>
        <button type="button" onClick={() => period(7)}>최근 일주일</button>
        <button type="button" onClick={() => period(30)}>최근 한달</button>
        <button type="button" onClick={() => period(365)}>1년</button>
        <button type="button" onClick={() => period(null)}>전체</button>
      </div>
      <div className="date-range">
        <input
          aria-label="시작일"
          type="date"
          value={draftFromDate}
          onChange={(event) => setDraftFromDate(event.target.value)}
        />
        <span>~</span>
        <input
          aria-label="종료일"
          type="date"
          value={draftToDate}
          onChange={(event) => setDraftToDate(event.target.value)}
        />
        <button type="button" className="dark" onClick={applyFilters}>조회</button>
      </div>
    </div>
  );
}

// 헬퍼 함수를 외부에서 쓰고 싶을 경우를 대비하여 export도 제공
export { localIsoDate, shiftDate, maximumReportDate };
