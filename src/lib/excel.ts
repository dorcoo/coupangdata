import type * as SheetJS from "xlsx";
import type { DailyMetric, ItemMetric, MatchingMetricKey, VendorImport } from "../types";

type RawRow = Record<string, unknown>;

declare global {
  interface Window {
    XLSX?: typeof SheetJS;
    XLSX_STYLE?: typeof SheetJS;
  }
}

const metricKeys: MatchingMetricKey[] = ["visitors", "views", "carts", "orders", "units_sold", "revenue"];
const sheetJsUrl = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
let sheetJsPromise: Promise<typeof SheetJS> | null = null;
let styledSheetJsPromise: Promise<typeof SheetJS> | null = null;

// 헤더 별칭 사전 정의 (쿠팡 양식 변동 대응)
const aliases: Record<string, string[]> = {
  date: ["날짜", "Date", "일자"],
  visitors: ["방문자", "방문자수", "유입수", "유입"],
  views: ["조회", "조회수", "페이지뷰", "클릭수"],
  carts: ["장바구니", "장바구니 담기", "장바구니수"],
  orders: ["주문", "주문수", "결제건수"],
  conversion_rate: ["구매전환율", "전환율", "구매 전환율"],
  units_sold: ["판매량", "수량", "판매수량", "판매수"],
  revenue: ["매출(원)", "매출", "순판매금액", "순 판매 금액", "판매 금액"],
  option_id: ["옵션 ID", "옵션ID", "Option ID"],
  option_name: ["옵션명", "옵션 이름", "옵션명칭"],
  product_name: ["상품명", "상품 이름", "상품명칭"],
  registered_product_id: ["등록상품ID", "등록상품 ID", "등록 상품 ID", "상품ID", "등록 상품ID"],
  category: ["카테고리", "분류"],
  fulfillment: ["판매방식", "판매 방식", "배송방식", "배송 방식"],
  winner_rate: ["아이템위너 비율(%)", "아이템위너비율(%)", "아이템위너 비율", "아이템 위너 비율"],
  gross_revenue: ["총 매출(원)", "총매출(원)", "총 매출", "총매출"],
  gross_units: ["총 판매수", "총판매수", "총 판매 수량"],
  cancel_amount: ["총 취소 금액(원)", "총취소금액(원)", "취소 금액", "취소금액"],
  cancelled_units: ["총 취소된 상품수", "총취소된상품수", "취소 상품수", "취소 수량"],
  immediately_cancelled_units: ["즉시 취소된 상품수", "즉시취소된상품수", "즉시 취소 상품수"],
};

function loadSheetJs(): Promise<typeof SheetJS> {
  if (sheetJsPromise) return sheetJsPromise;
  sheetJsPromise = new Promise((resolve, reject) => {
    const existing = window.XLSX;
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = sheetJsUrl;
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("엑셀 파서 초기화에 실패했습니다."));
    script.onerror = () => reject(new Error("엑셀 파서를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return sheetJsPromise;
}

function loadStyledSheetJs(): Promise<typeof SheetJS> {
  if (window.XLSX_STYLE) return Promise.resolve(window.XLSX_STYLE);
  if (styledSheetJsPromise) return styledSheetJsPromise;
  styledSheetJsPromise = new Promise((resolve, reject) => {
    const standardXlsx = window.XLSX;
    const script = document.createElement("script");
    script.src = new URL("./xlsx-js-style.min.js", document.baseURI).href;
    script.onload = () => {
      const styledXlsx = window.XLSX;
      window.XLSX = standardXlsx;
      if (!styledXlsx?.utils?.book_new || !styledXlsx.writeFile) {
        styledSheetJsPromise = null;
        reject(new Error("히트맵 엑셀 모듈 초기화에 실패했습니다."));
        return;
      }
      window.XLSX_STYLE = styledXlsx;
      resolve(styledXlsx);
    };
    script.onerror = () => {
      window.XLSX = standardXlsx;
      styledSheetJsPromise = null;
      reject(new Error("히트맵 엑셀 모듈을 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });
  return styledSheetJsPromise;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replace(/,/g, "").trim()) || 0;
}

function stringValue(value: unknown): string {
  if (value && typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return String(value.result ?? "").trim();
  }
  return String(value ?? "").trim();
}

function isoDate(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    const year = excelEpoch.getUTCFullYear();
    const month = String(excelEpoch.getUTCMonth() + 1).padStart(2, "0");
    const day = String(excelEpoch.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = stringValue(value);
  if (!text || /^(합계|총계|total)$/i.test(text)) return "";
  return text.replace(/[./]/g, "-").slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// 행 객체에서 별칭 사전을 기반으로 실제 키를 찾아내거나 에러를 발생시키는 함수
function getRequiredKey(row: RawRow, key: keyof typeof aliases, fileName: string): string {
  const candidates = aliases[key];
  const found = Object.keys(row).find((k) => candidates.includes(k.trim()));
  if (!found) {
    throw new Error(
      `[파일 오류] '${fileName}' 파일에서 필수 항목인 '${candidates[0]}'을(를) 찾을 수 없습니다.\n` +
      `대조 가능한 유사 이름: [${candidates.join(", ")}]\n` +
      `엑셀 파일의 헤더를 확인해 주세요.`
    );
  }
  return found;
}

async function readFirstSheet(file: File): Promise<RawRow[]> {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error(`'${file.name}'에서 엑셀 시트를 찾지 못했습니다.`);
  return XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: "" });
}

export async function parseDailySummary(file: File): Promise<DailyMetric[]> {
  const raw = await readFirstSheet(file);
  if (!raw.length) {
    throw new Error(`'${file.name}' 파일에 데이터가 없습니다.`);
  }

  // 필수 헤더들의 매핑 키 검출
  const keyDate = getRequiredKey(raw[0], "date", file.name);
  const keyVisitors = getRequiredKey(raw[0], "visitors", file.name);
  const keyViews = getRequiredKey(raw[0], "views", file.name);
  const keyCarts = getRequiredKey(raw[0], "carts", file.name);
  const keyOrders = getRequiredKey(raw[0], "orders", file.name);
  const keyConv = getRequiredKey(raw[0], "conversion_rate", file.name);
  const keyUnits = getRequiredKey(raw[0], "units_sold", file.name);
  const keyRev = getRequiredKey(raw[0], "revenue", file.name);

  const rows = raw
    .map((row) => ({
      metric_date: isoDate(row[keyDate]),
      visitors: numberValue(row[keyVisitors]),
      views: numberValue(row[keyViews]),
      carts: numberValue(row[keyCarts]),
      orders: numberValue(row[keyOrders]),
      conversion_rate: stringValue(row[keyConv]),
      units_sold: numberValue(row[keyUnits]),
      revenue: numberValue(row[keyRev]),
      source_file: file.name,
    }))
    .filter((row) => isValidIsoDate(row.metric_date));

  if (!rows.length) {
    throw new Error(`'${file.name}' 파일에서 유효한 날짜 행을 찾지 못했습니다. 날짜 컬럼 값을 확인해 주세요.`);
  }

  return rows;
}

export async function parseVendorItems(file: File): Promise<VendorImport> {
  const raw = await readFirstSheet(file);
  if (!raw.length) {
    throw new Error(`'${file.name}' 파일에 데이터가 없습니다.`);
  }

  // 상품 상세 엑셀의 필수 헤더 매핑 키 검출
  const keyOptionId = getRequiredKey(raw[0], "option_id", file.name);
  const keyOptionName = getRequiredKey(raw[0], "option_name", file.name);
  const keyProdName = getRequiredKey(raw[0], "product_name", file.name);
  const keyRegProdId = getRequiredKey(raw[0], "registered_product_id", file.name);
  const keyCategory = getRequiredKey(raw[0], "category", file.name);
  const keyFulfillment = getRequiredKey(raw[0], "fulfillment", file.name);
  const keyRev = getRequiredKey(raw[0], "revenue", file.name);
  const keyOrders = getRequiredKey(raw[0], "orders", file.name);
  const keyUnits = getRequiredKey(raw[0], "units_sold", file.name);
  const keyVisitors = getRequiredKey(raw[0], "visitors", file.name);
  const keyViews = getRequiredKey(raw[0], "views", file.name);
  const keyCarts = getRequiredKey(raw[0], "carts", file.name);
  const keyConv = getRequiredKey(raw[0], "conversion_rate", file.name);
  const keyWinner = getRequiredKey(raw[0], "winner_rate", file.name);
  const keyGrossRev = getRequiredKey(raw[0], "gross_revenue", file.name);
  const keyGrossUnits = getRequiredKey(raw[0], "gross_units", file.name);
  const keyCancelAmt = getRequiredKey(raw[0], "cancel_amount", file.name);
  const keyCancelUnits = getRequiredKey(raw[0], "cancelled_units", file.name);
  const keyImmCancel = getRequiredKey(raw[0], "immediately_cancelled_units", file.name);

  const rows: Omit<ItemMetric, "metric_date">[] = raw.map((row) => ({
    option_id: stringValue(row[keyOptionId]),
    option_name: stringValue(row[keyOptionName]),
    product_name: stringValue(row[keyProdName]),
    registered_product_id: stringValue(row[keyRegProdId]),
    category: stringValue(row[keyCategory]),
    fulfillment: stringValue(row[keyFulfillment]),
    revenue: numberValue(row[keyRev]),
    orders: numberValue(row[keyOrders]),
    units_sold: numberValue(row[keyUnits]),
    visitors: numberValue(row[keyVisitors]),
    views: numberValue(row[keyViews]),
    carts: numberValue(row[keyCarts]),
    conversion_rate: stringValue(row[keyConv]),
    winner_rate: stringValue(row[keyWinner]),
    gross_revenue: numberValue(row[keyGrossRev]),
    gross_units: numberValue(row[keyGrossUnits]),
    cancel_amount: numberValue(row[keyCancelAmt]),
    cancelled_units: numberValue(row[keyCancelUnits]),
    immediately_cancelled_units: numberValue(row[keyImmCancel]),
    source_file: file.name,
  }));

  const totals = Object.fromEntries(
    metricKeys.map((key) => [key, rows.reduce((total, row) => total + row[key], 0)]),
  ) as Pick<ItemMetric, MatchingMetricKey>;

  return { source_file: file.name, rows, totals, matched_date: null };
}

export function findMatchedDate(report: VendorImport, daily: DailyMetric[]): string | null {
  const matches = daily.filter((day) => metricKeys.every((key) => day[key] === report.totals[key]));
  return matches.length === 1 ? matches[0].metric_date : null;
}

export function withMetricDate(report: VendorImport, metricDate: string): ItemMetric[] {
  if (!isValidIsoDate(metricDate)) {
    throw new Error(`${report.source_file}의 날짜가 비어 있거나 올바르지 않습니다. 저장 전 날짜를 선택해 주세요.`);
  }
  return report.rows.map((row) => ({ ...row, metric_date: metricDate }));
}

export async function downloadXlsx(rows: Array<Array<string | number>>, filename: string): Promise<void> {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "분석");
  XLSX.writeFile(workbook, filename);
}

interface HeatmapXlsxOptions {
  dataStartRow: number;
  heatmapStartColumn: number;
  heatmapEndColumn: number;
  totalStartColumn: number;
  color: "blue" | "green" | "red";
  ratioMetric?: boolean;
}

const heatmapColors = {
  blue: [37, 99, 235],
  green: [16, 185, 129],
  red: [239, 68, 68],
} as const;

function blendWithWhite(rgb: readonly number[], ratio: number): string {
  const alpha = 0.08 + Math.min(1, Math.max(0, ratio)) * 0.48;
  return rgb
    .map((channel) => Math.round(255 + (channel - 255) * alpha).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function downloadHeatmapXlsx(
  rows: Array<Array<string | number>>,
  filename: string,
  options: HeatmapXlsxOptions,
): Promise<void> {
  const XLSX = await loadStyledSheetJs();
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const lastColumn = Math.max(0, ...rows.map((row) => row.length - 1));
  const border = {
    bottom: { style: "thin" as const, color: { rgb: "E2E8F0" } },
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address];
      if (!cell) continue;
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
        font: { name: "맑은 고딕", sz: 10, color: { rgb: "334A62" } },
        alignment: { horizontal: columnIndex < options.heatmapStartColumn ? "left" : "right", vertical: "center" },
        border,
      };
      if (typeof cell.v === "number") {
        cell.s.numFmt = options.ratioMetric ? '0.00"%"' : "#,##0";
      }
    }
  }

  for (let columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: columnIndex })];
    if (!cell) continue;
    cell.s = {
      ...cell.s,
      fill: { patternType: "solid", fgColor: { rgb: "1E3A5F" } },
      font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
  }

  for (let columnIndex = 0; columnIndex <= lastColumn; columnIndex += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 1, c: columnIndex })];
    if (!cell) continue;
    cell.s = {
      ...cell.s,
      fill: { patternType: "solid", fgColor: { rgb: "DFEAF6" } },
      font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: "17324F" } },
    };
  }

  const baseColor = heatmapColors[options.color];
  for (let rowIndex = options.dataStartRow; rowIndex < rows.length; rowIndex += 1) {
    const values = rows[rowIndex]
      .slice(options.heatmapStartColumn, options.heatmapEndColumn + 1)
      .map((value) => typeof value === "number" ? Math.abs(value) : 0);
    const maximum = Math.max(0, ...values);
    if (maximum <= 0) continue;
    values.forEach((value, offset) => {
      if (value === 0) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: options.heatmapStartColumn + offset });
      const cell = worksheet[address];
      if (!cell) return;
      cell.s = {
        ...cell.s,
        fill: { patternType: "solid", fgColor: { rgb: blendWithWhite(baseColor, value / maximum) } },
      };
    });
  }

  for (let rowIndex = options.dataStartRow; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = options.totalStartColumn; columnIndex <= lastColumn; columnIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (!cell) continue;
      cell.s = {
        ...cell.s,
        fill: { patternType: "solid", fgColor: { rgb: "F0F7FF" } },
        font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: "17324F" } },
      };
    }
  }

  worksheet["!cols"] = rows[0].map((_, columnIndex) => ({
    wch: columnIndex === 3 ? 42 : columnIndex < 3 ? 16 : 14,
  }));
  worksheet["!rows"] = rows.map((_, rowIndex) => ({ hpt: rowIndex === 0 ? 24 : 20 }));
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: rows.length - 1, c: lastColumn }) };
  XLSX.utils.book_append_sheet(workbook, worksheet, "피벗 분석");
  XLSX.writeFile(workbook, filename);
}
