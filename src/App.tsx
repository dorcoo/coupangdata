import { useEffect, useMemo, useRef, useState } from "react";
import { clearAnalyticsData, isServerStorage, loadDaily, loadItems } from "./lib/analyticsRepository";
import type { DailyMetric, FulfillmentFilter, ItemMetric, View } from "./types";
import { buildTrendSeries } from "./lib/analyticsHelper";

// 헬퍼 및 컴포넌트 임포트
import { maximumReportDate, shiftDate } from "./components/Layout/AnalyticsToolbar";
import Sidebar from "./components/Layout/Sidebar";
import AnalyticsToolbar from "./components/Layout/AnalyticsToolbar";
import DashboardPanel from "./components/Dashboard/DashboardPanel";
import TrendPanel from "./components/Analytics/TrendPanel";
import CategoryPanel from "./components/Analytics/CategoryPanel";
import WinnerRiskPanel from "./components/Analytics/WinnerRiskPanel";
import PivotPanel from "./components/Analytics/PivotPanel";
import ProductsPanel from "./components/Analytics/ProductsPanel";
import ImportPanel from "./components/Settings/ImportPanel";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [items, setItems] = useState<ItemMetric[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [serverConnected, setServerConnected] = useState(false);
  const initialPeriodSet = useRef(false);

  // 레포지토리에서 데이터 로드
  useEffect(() => {
    let active = true;
    setLoading(true);
    const connection = isServerStorage().then((connected) => {
      if (active) setServerConnected(connected);
    });
    Promise.all([loadDaily(), loadItems(), connection])
      .then(([nextDaily, nextItems]) => {
        if (!active) return;
        setDaily(nextDaily);
        setItems(nextItems);
      })
      .catch((error: Error) => active && setMessage(`데이터를 불러오지 못했습니다: ${error.message}`))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setServerConnected(await isServerStorage());
    const [nextDaily, nextItems] = await Promise.all([
      loadDaily(),
      loadItems(),
    ]);
    setDaily(nextDaily);
    setItems(nextItems);
  }

  // 사용 가능한 전체 날짜 추출
  const allDates = useMemo(
    () => [...new Set([...daily.map((row) => row.metric_date), ...items.map((row) => row.metric_date)])].sort(),
    [daily, items],
  );

  // 컴포넌트 첫 진입 시 기본 필터 날짜 설정 (최근 일주일)
  useEffect(() => {
    if (initialPeriodSet.current || !allDates.length || fromDate || toDate) return;
    const maximum = maximumReportDate(allDates);
    if (!maximum) return;
    setFromDate(shiftDate(maximum, -6));
    setToDate(maximum);
    initialPeriodSet.current = true;
  }, [allDates, fromDate, toDate]);

  // 검색, 날짜 범위 필터 가공
  const baseFilteredItems = useMemo(() => items.filter(
    (item) =>
      (!fromDate || item.metric_date >= fromDate) &&
      (!toDate || item.metric_date <= toDate) &&
      (!query ||
        `${item.product_name} ${item.registered_product_id} ${item.option_name} ${item.option_id}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  ), [items, fromDate, toDate, query]);

  const filteredItems = useMemo(() => baseFilteredItems.filter(
    (item) => fulfillmentFilter === "all" || item.fulfillment.trim() === fulfillmentFilter,
  ), [baseFilteredItems, fulfillmentFilter]);

  const filteredDaily = daily.filter(
    (row) => (!fromDate || row.metric_date >= fromDate) && (!toDate || row.metric_date <= toDate)
  );

  const series = buildTrendSeries(
    filteredDaily,
    filteredItems,
    Boolean(query) || fulfillmentFilter !== "all"
  );

  // 분석 데이터 초기화
  async function resetData() {
    if (!window.confirm("업로드된 일별/상품별 분석 데이터를 모두 초기화할까요?")) return;
    try {
      await clearAnalyticsData();
      await refresh();
      setMessage("분석 데이터를 초기화했습니다.");
    } catch (error) {
      setMessage(`초기화 실패: ${(error as Error).message}`);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▤</span>
          <div>
            <h1>쿠팡 판매량 분석기</h1>
            <p>쿠팡 판매량 확인용</p>
          </div>
          <span className={`mode${serverConnected ? " cloud" : ""}`}>자동 저장</span>
        </div>
        <button type="button" className="reset" onClick={resetData}>
          전체 데이터 초기화
        </button>
      </header>
      <div className={`workspace ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar
          view={view}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onSelect={setView}
        />
        <main className="content">
          {view !== "import" && (
            <AnalyticsToolbar
              query={query}
              fromDate={fromDate}
              toDate={toDate}
              allDates={allDates}
              fulfillmentFilter={fulfillmentFilter}
              onQuery={setQuery}
              onFromDate={setFromDate}
              onToDate={setToDate}
              onFulfillmentFilter={setFulfillmentFilter}
            />
          )}
          {message && (
            <div className="notice" role="status">
              {message}
              <button type="button" onClick={() => setMessage("")}>닫기</button>
            </div>
          )}
          {loading && <p className="loading">데이터를 읽고 있습니다...</p>}
          {view === "dashboard" && (
            <DashboardPanel
              items={filteredItems}
              series={series}
            />
          )}
          {view === "trend" && <TrendPanel series={series} items={filteredItems} />}
          {view === "categories" && <CategoryPanel items={filteredItems} />}
          {view === "winner" && <WinnerRiskPanel items={filteredItems} />}
          {view === "pivot" && (
            <PivotPanel
              items={filteredItems}
              fulfillmentFilter={fulfillmentFilter}
              onFulfillmentFilter={setFulfillmentFilter}
            />
          )}
          {view === "products" && (
            <ProductsPanel items={filteredItems} />
          )}
          {view === "import" && (
            <ImportPanel
              daily={daily}
              onSaved={async (text) => {
                setMessage(text);
                try { await refresh(); }
                catch (error) { setMessage(`${text} 화면 갱신 실패: ${(error as Error).message}`); }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
