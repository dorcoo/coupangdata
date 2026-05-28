import { useState, type ChangeEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyMetric, VendorImport } from "../../types";
import {
  downloadXlsx,
  findMatchedDate,
  parseDailySummary,
  parseVendorItems,
  withMetricDate,
} from "../../lib/excel";
import { saveDaily, saveItems } from "../../lib/repository";
import { compareSort, number, type SortDirection } from "../../lib/analyticsHelper";
import SortHeader from "../Common/SortHeader";

interface ImportPanelProps {
  daily: DailyMetric[];
  client: SupabaseClient | null;
  onSaved: (text: string) => Promise<void>;
}

export default function ImportPanel({
  daily,
  client,
  onSaved,
}: ImportPanelProps) {
  const [reports, setReports] = useState<VendorImport[]>([]);
  const [manualDates, setManualDates] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [sortKey, setSortKey] = useState<"source_file" | "matched_date" | "revenue" | "units_sold" | "rows">("matched_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedReports = [...reports].sort((left, right) => {
    const leftValue =
      sortKey === "rows"
        ? left.rows.length
        : sortKey === "matched_date"
        ? manualDates[left.source_file] ?? ""
        : sortKey === "source_file"
        ? left.source_file
        : left.totals[sortKey];
    const rightValue =
      sortKey === "rows"
        ? right.rows.length
        : sortKey === "matched_date"
        ? manualDates[right.source_file] ?? ""
        : sortKey === "source_file"
        ? right.source_file
        : right.totals[sortKey];
    return compareSort(leftValue, rightValue, sortDirection);
  });

  function changeSort(nextKey: typeof sortKey) {
    setSortDirection(sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc");
    setSortKey(nextKey);
  }

  async function exportReview() {
    await downloadXlsx(
      [
        ["파일", "매칭 날짜", "매출(원)", "판매량", "상품 행"],
        ...sortedReports.map((report) => [
          report.source_file,
          manualDates[report.source_file] ?? "",
          report.totals.revenue,
          report.totals.units_sold,
          report.rows.length,
        ]),
      ],
      "coupang-import-review.xlsx",
    );
  }

  async function importSummary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    try {
      const rows = await parseDailySummary(file);
      await saveDaily(client, rows);
      await onSaved(`${file.name}: 일별 요약 ${rows.length}일을 저장했습니다.`);
    } catch (error) {
      await onSaved((error as Error).message);
    } finally {
      setWorking(false);
      event.target.value = "";
    }
  }

  async function readVendorFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setWorking(true);
    try {
      const loaded = await Promise.all(files.map(parseVendorItems));
      const matched = loaded.map((report) => ({ ...report, matched_date: findMatchedDate(report, daily) }));
      setReports(matched);
      const dates = Object.fromEntries(matched.map((report) => [report.source_file, report.matched_date ?? ""]));
      setManualDates(dates);
      await onSaved(`${matched.length}개 상품별 파일을 읽었습니다. 날짜를 확인한 후 저장하세요.`);
    } catch (error) {
      await onSaved((error as Error).message);
    } finally {
      setWorking(false);
      event.target.value = "";
    }
  }

  async function commitReports() {
    const missing = reports.find((report) => !manualDates[report.source_file]);
    if (missing) {
      await onSaved(`${missing.source_file}의 날짜를 지정해야 합니다.`);
      return;
    }
    setWorking(true);
    try {
      for (const report of reports) {
        await saveItems(client, withMetricDate(report, manualDates[report.source_file]));
      }
      await onSaved(`상품별 지표 ${reports.reduce((sum, report) => sum + report.rows.length, 0)}행을 저장했습니다.`);
      setReports([]);
    } catch (error) {
      await onSaved(`저장 실패: ${(error as Error).message}`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="panel import-panel">
      <div className="panel-heading">
        <div>
          <h2>엑셀 가져오기</h2>
          <p>일별 요약을 먼저 저장하면 상품 지표의 날짜를 6개 핵심 합계로 자동 매칭합니다.</p>
        </div>
      </div>
      <div className="upload-grid">
        <label className="dropzone">
          <b>1. 일별 요약 파일</b>
          <span>`DAILY_SUMMARY_METRICS` 엑셀</span>
          <input type="file" accept=".xlsx,.xls" onChange={importSummary} disabled={working} />
        </label>
        <label className="dropzone">
          <b>2. 상품별 지표 파일</b>
          <span>`VENDOR_ITEM_METRICS` 여러 개 선택 가능</span>
          <input type="file" accept=".xlsx,.xls" multiple onChange={readVendorFiles} disabled={working} />
        </label>
      </div>
      <p className="helper">
        현재 저장된 일별 요약:{" "}
        {daily.length
          ? `${daily[0].metric_date} ~ ${daily[daily.length - 1].metric_date} (${daily.length}일)`
          : "없음"}
      </p>
      {reports.length > 0 && (
        <div className="review">
          <div className="review-head">
            <h3>저장 전 날짜 확인</h3>
            <button type="button" className="export" onClick={exportReview}>
              엑셀 다운로드
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <SortHeader
                  label="파일"
                  active={sortKey === "source_file"}
                  direction={sortDirection}
                  onClick={() => changeSort("source_file")}
                />
                <SortHeader
                  label="자동 매칭 날짜"
                  active={sortKey === "matched_date"}
                  direction={sortDirection}
                  onClick={() => changeSort("matched_date")}
                />
                <SortHeader
                  label="매출"
                  active={sortKey === "revenue"}
                  direction={sortDirection}
                  onClick={() => changeSort("revenue")}
                />
                <SortHeader
                  label="판매량"
                  active={sortKey === "units_sold"}
                  direction={sortDirection}
                  onClick={() => changeSort("units_sold")}
                />
                <SortHeader
                  label="상품 행"
                  active={sortKey === "rows"}
                  direction={sortDirection}
                  onClick={() => changeSort("rows")}
                />
              </tr>
            </thead>
            <tbody>
              {sortedReports.map((report) => (
                <tr key={report.source_file}>
                  <td>{report.source_file}</td>
                  <td>
                    <input
                      type="date"
                      value={manualDates[report.source_file] ?? ""}
                      onChange={(event) =>
                        setManualDates({ ...manualDates, [report.source_file]: event.target.value })
                      }
                    />
                  </td>
                  <td>{number(report.totals.revenue)}원</td>
                  <td>{number(report.totals.units_sold)}</td>
                  <td>{number(report.rows.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="primary" onClick={commitReports} disabled={working}>
            확정하여 저장
          </button>
        </div>
      )}
    </section>
  );
}
