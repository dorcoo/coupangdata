import type { TrendPoint } from "../../types";
import { number } from "../../lib/analyticsHelper";

interface DailyAdBudgetProps {
  series: TrendPoint[];
}

function budget(revenue: number, rate: number) {
  return Math.round(Math.max(0, revenue) * rate);
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

export default function DailyAdBudget({ series }: DailyAdBudgetProps) {
  const rows = [...series].sort((left, right) => right.date.localeCompare(left.date));
  const totalRevenue = rows.reduce((total, row) => total + Math.max(0, row.revenue), 0);

  return (
    <section className="dashboard-card ad-budget-card">
      <div className="section-head ad-budget-head">
        <div>
          <h2>일별 권장 광고비</h2>
          <p className="section-description">
            순 판매 금액의 4%를 기준으로 운영하고, 상황에 따라 3~5% 범위에서 조정하세요.
          </p>
        </div>
        <div className="ad-budget-summary" aria-label="조회 기간 권장 광고비">
          <span>조회 기간 권장액 (4%)</span>
          <strong>{number(budget(totalRevenue, 0.04))}원</strong>
          <small>
            운영 범위 {number(budget(totalRevenue, 0.03))}원 ~ {number(budget(totalRevenue, 0.05))}원
          </small>
        </div>
      </div>

      {rows.length ? (
        <div className="table-wrap ad-budget-table">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>순 판매 금액</th>
                <th>최소 광고비 (3%)</th>
                <th>기준 광고비 (4%)</th>
                <th>확대 광고비 (5%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{displayDate(row.date)}</td>
                  <td>{number(row.revenue)}원</td>
                  <td>{number(budget(row.revenue, 0.03))}원</td>
                  <td className="ad-budget-recommended">{number(budget(row.revenue, 0.04))}원</td>
                  <td>{number(budget(row.revenue, 0.05))}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">선택한 기간에 광고비를 계산할 매출 데이터가 없습니다.</div>
      )}
    </section>
  );
}
