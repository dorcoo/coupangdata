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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = localIsoDate(yesterday);
  return [...allDates].reverse().find((date) => date <= cutoff) ?? allDates[allDates.length - 1] ?? "";
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

  function period(days: number | null) {
    if (!maximum || days === null) {
      onFromDate("");
      onToDate("");
      return;
    }
    onFromDate(shiftDate(maximum, -days + 1));
    onToDate(maximum);
  }

  return (
    <div className="analytics-toolbar">
      <label className="toolbar-search">
        ⌕
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="상품 또는 옵션 검색"
        />
      </label>
      <div className="segmented">
        <button
          type="button"
          className={fulfillmentFilter === "all" ? "active" : ""}
          onClick={() => onFulfillmentFilter("all")}
        >
          전체 방식
        </button>
        <button
          type="button"
          className={fulfillmentFilter === "로켓그로스" ? "active" : ""}
          onClick={() => onFulfillmentFilter("로켓그로스")}
        >
          로켓그로스
        </button>
        <button
          type="button"
          className={fulfillmentFilter === "판매자배송" ? "active" : ""}
          onClick={() => onFulfillmentFilter("판매자배송")}
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
          value={fromDate}
          onChange={(event) => onFromDate(event.target.value)}
        />
        <span>~</span>
        <input
          aria-label="종료일"
          type="date"
          value={toDate}
          onChange={(event) => onToDate(event.target.value)}
        />
        <button type="button" className="dark">조회</button>
      </div>
    </div>
  );
}

// 헬퍼 함수를 외부에서 쓰고 싶을 경우를 대비하여 export도 제공
export { localIsoDate, shiftDate, maximumReportDate };
