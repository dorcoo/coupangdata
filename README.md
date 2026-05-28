# 쿠팡 판매량 분석 허브

쿠팡 Seller Insights 엑셀을 매번 수동으로 합치지 않고, 브라우저에서 업로드하여 상품별 피벗과 대화 HTML 기록을 관리하는 React + Supabase 앱입니다.

## 포함 기능

- `DAILY_SUMMARY_METRICS` 업로드 및 날짜별 요약 저장
- `VENDOR_ITEM_METRICS` 파일 다중 업로드
- 방문자, 조회, 장바구니, 주문, 판매량, 매출 합계로 상품 파일 날짜 자동 매칭
- 상품명/옵션명 기준 날짜별 피벗 조회
- 매출, 판매량, 주문, 방문자, 조회, 장바구니 지표 전환
- 구매전환율, 아이템위너 비율, 총 매출/판매수, 취소 금액/수량/취소율 피벗 조회
- 요약 대시보드 KPI와 일별 추이 차트
- 카테고리별 매출 비중 및 상품/옵션 실적 목록
- 차트 지표 전환 및 마우스 오버 날짜별 수치 확인
- 매출 비중/수량 비중 전환과 상품별 비중 표시
- 아이템위너 100% 미만 위험 모니터링 및 위험도 필터
- 상품 클릭 상세 화면: 조회수, 판매량, 매출, 전환율 추이
- 검색, 기간 빠른 선택, 피벗/상품 상세 Excel 다운로드, 확인형 분석 데이터 초기화
- Supabase Auth 로그인 및 RLS 기반 사용자별 데이터 보호
- Supabase 설정 전 브라우저 `localStorage` 시험 모드

## 실행

배포 URL: <https://dorcoo.github.io/coupangdata/>

가장 간단한 방법은 `판매량 분석기 실행.cmd`를 더블클릭하는 것입니다. 서버가 실행되고 브라우저가 자동으로 열립니다.

```powershell
npm install
npm run dev
```

정적인 미리보기만 필요하면 루트의 `index.html`을 더블클릭해도 단일 파일로 빌드된 `dist/index.html` 화면으로 자동 이동합니다. Supabase 로그인과 데이터 저장에는 위 실행 방식 또는 웹 호스팅을 권장합니다.

앱이 열린 뒤 `엑셀 가져오기`에서 다음 순서로 업로드합니다.

1. `SELLER_INSIGHTS_DAILY_SUMMARY_METRICS...xlsx`
2. 하나 이상의 `SELLER_INSIGHTS_VENDOR_ITEM_METRICS...xlsx`
3. 자동 매칭 날짜를 확인하고 `확정하여 저장`

현재 확인한 원본 파일 날짜는 다음과 같습니다.

| 파일 | 날짜 |
| --- | --- |
| `SELLER_INSIGHTS_VENDOR_ITEM_METRICS_(0) (4).xlsx` | 2026-05-24 |
| `SELLER_INSIGHTS_VENDOR_ITEM_METRICS_(0) (3).xlsx` | 2026-05-25 |
| `SELLER_INSIGHTS_VENDOR_ITEM_METRICS_(0) (2).xlsx` | 2026-05-26 |

## Supabase 연결

1. 새 Supabase 프로젝트를 생성합니다.
2. Supabase SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql)을 실행합니다.
3. `.env.example`을 `.env.local`로 복사합니다.
4. 프로젝트의 URL과 Publishable key를 입력합니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. 앱의 `Supabase 설정` 탭에서 가입하거나 로그인합니다.

로그인 전에는 로컬 시험 모드로 작동합니다. 로그인 후 업로드한 자료는 Supabase에 저장되며 사용자 본인만 읽고 수정할 수 있습니다.

## 피벗 지표 기준

- 구매전환율: `주문 / 조회`
- 아이템위너 비율: 상품이 여러 옵션으로 묶일 때 조회수 기준 가중평균
- 취소율: `총 취소 상품수 / 총 판매수`
- 쿠팡 원본의 취소 금액 및 수량은 음수로 제공되므로 화면에서는 취소 규모를 알기 쉽게 절대값으로 표시합니다.

## 참고

- Supabase React Quickstart: <https://supabase.com/docs/guides/getting-started/quickstarts/reactjs>
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
