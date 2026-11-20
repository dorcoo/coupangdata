import type { DailyMetric, ItemMetric } from "../types";

const DATABASE_NAME = "coupang-sales-hub";
const DAILY_KEY = "coupang.daily_metrics";
const ITEM_KEY = "coupang.item_metrics";
const MIGRATION_KEY = "legacy-analytics-migrated";
type StoreName = "daily" | "items" | "meta";
let databasePromise: Promise<IDBDatabase> | null = null;

function storageError(error: unknown): Error {
  if (error instanceof DOMException && /quota/i.test(error.name)) {
    return new Error("브라우저 저장 공간이 부족해 저장하지 못했습니다. 기존 데이터와 업로드 목록은 유지됩니다. 기기의 여유 공간을 확보한 뒤 다시 시도해 주세요.");
  }
  return error instanceof Error ? error : new Error("브라우저 저장소를 사용할 수 없습니다. 브라우저의 저장소 설정을 확인해 주세요.");
}

function transact<T = void>(
  database: IDBDatabase,
  stores: StoreName[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction, setResult: (result: T) => void, abort: (error: unknown) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    let result: T;
    let operationError: unknown;
    try {
      transaction = database.transaction(stores, mode);
      const active = transaction;
      active.oncomplete = () => resolve(result);
      active.onabort = () => reject(storageError(operationError ?? active.error));
      run(active, (value) => { result = value; }, (error) => {
        operationError = error;
        active.abort();
      });
    } catch (error) {
      // 동기 오류가 발생해도 앞서 요청한 쓰기가 일부만 저장되지 않게 합니다.
      operationError = error;
      if (transaction) transaction.abort();
      else reject(storageError(error));
    }
  });
}

function legacyRows<T>(key: string): T[] {
  const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (!Array.isArray(parsed)) throw new Error("기존 브라우저 데이터 형식이 올바르지 않습니다. 기존 데이터는 보존되어 있습니다.");
  return parsed as T[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저에서는 데이터 저장소를 사용할 수 없습니다. 최신 Chrome 또는 Edge로 열어 주세요."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("daily", { keyPath: "metric_date" });
      database.createObjectStore("items", { keyPath: ["metric_date", "option_id"] });
      database.createObjectStore("meta");
    };
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("다른 탭이 저장소를 사용 중입니다. 이 앱의 다른 탭을 닫고 새로고침해 주세요."));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
  });
}

function database(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase().then(async (opened) => {
      try {
        await transact(opened, ["daily", "items", "meta"], "readwrite", (transaction, _setResult, abort) => {
          const meta = transaction.objectStore("meta");
          const migration = meta.get(MIGRATION_KEY);
          migration.onsuccess = () => {
            if (migration.result) return;
            try {
              legacyRows<DailyMetric>(DAILY_KEY).forEach((row) => transaction.objectStore("daily").put(row));
              legacyRows<ItemMetric>(ITEM_KEY).forEach((row) => transaction.objectStore("items").put(row));
              meta.put(true, MIGRATION_KEY);
            } catch (error) {
              // 마이그레이션 전체를 취소하고 기존 localStorage 자료를 보존합니다.
              abort(error);
            }
          };
        });
        return opened;
      } catch (error) {
        opened.close();
        throw error;
      }
    }).catch((error: unknown) => {
      databasePromise = null;
      throw storageError(error);
    });
  }
  return databasePromise;
}

async function readAll<T>(store: StoreName): Promise<T[]> {
  return transact<T[]>(await database(), [store], "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => setResult(request.result as T[]);
  });
}

export async function loadDaily(): Promise<DailyMetric[]> {
  return readAll<DailyMetric>("daily");
}

export async function saveDaily(rows: DailyMetric[]): Promise<void> {
  return transact(await database(), ["daily"], "readwrite", (transaction) => {
    const store = transaction.objectStore("daily");
    rows.forEach((row) => store.put(row));
  });
}

export async function loadItems(): Promise<ItemMetric[]> {
  return readAll<ItemMetric>("items");
}

export async function saveItems(rows: ItemMetric[]): Promise<void> {
  return transact(await database(), ["items"], "readwrite", (transaction) => {
    const store = transaction.objectStore("items");
    rows.forEach((row) => store.put(row));
  });
}

export async function clearAnalyticsData(): Promise<void> {
  await transact(await database(), ["daily", "items"], "readwrite", (transaction) => {
    transaction.objectStore("daily").clear();
    transaction.objectStore("items").clear();
  });
  try {
    localStorage.removeItem(DAILY_KEY);
    localStorage.removeItem(ITEM_KEY);
  } catch {
    // 완료된 마이그레이션은 다시 실행하지 않으므로 과거 자료가 되살아나지 않습니다.
  }
}

export async function loadPreference<T>(key: string): Promise<T | null> {
  return transact<T | null>(await database(), ["meta"], "readonly", (transaction, setResult) => {
    const request = transaction.objectStore("meta").get(key);
    request.onsuccess = () => setResult((request.result as T | undefined) ?? null);
  });
}

export async function savePreference(key: string, value: unknown): Promise<void> {
  return transact(await database(), ["meta"], "readwrite", (transaction) => {
    const store = transaction.objectStore("meta");
    if (value === null) store.delete(key);
    else store.put(value, key);
  });
}
