# 쿠팡 판매량 분석 허브

쿠팡 Seller Insights 엑셀을 불러와 상품별 피벗과 판매 실적을 분석하는 앱입니다. `판매량 분석기.html`만 열면 로그인이나 연결 설정 없이 수파베이스 자료를 불러옵니다. 별도 실행 파일이나 로컬 서버는 필요하지 않습니다.

## 포함 기능

- `DAILY_SUMMARY_METRICS` 업로드 및 날짜별 요약 저장
- `VENDOR_ITEM_METRICS` 파일 다중 업로드
- 방문자, 조회, 장바구니, 주문, 판매량, 매출 합계로 상품 파일 날짜 자동 매칭
- 상품명/옵션명 기준 날짜별 피벗 조회
- 매출, 판매량, 주문, 방문자, 조회, 장바구니 지표 전환
- 구매전환율, 아이템위너 비율, 총 매출/판매수, 취소 금액/수량/취소율 피벗 조회
- 요약 대시보드 KPI와 일별 추이 차트
- 요약 대시보드에서 일별 매출의 3~5% 권장 광고비 자동 계산
- 카테고리별 매출 비중 및 상품/옵션 실적 목록
- 차트 지표 전환 및 마우스 오버 날짜별 수치 확인
- 매출 비중/수량 비중 전환과 상품별 비중 표시
- 아이템위너 100% 미만 위험 모니터링 및 위험도 필터
- 상품 클릭 상세 화면: 조회수, 판매량, 매출, 전환율 추이
- 검색, 기간 빠른 선택, 피벗/상품 상세 Excel 다운로드, 확인형 분석 데이터 초기화
- 로그인 없이 서버에 분석 데이터 자동 저장
- 기존 `localStorage` 분석 데이터 자동 이전 및 원본 보존
- 여러 상품 파일을 한 번에 저장하며, 저장 실패 시 전체 취소 및 업로드 목록 유지
- 기존 Supabase 프로젝트의 다른 서비스와 분리된 분석기 전용 테이블 사용
- HTML에서 분석기 전용 권한으로 수파베이스 직접 연결
- 기존 브라우저 자료를 서버에 자동 복사하며 이미 저장된 서버 자료는 덮어쓰지 않음

## 실행

배포 URL: <https://dorcoo.github.io/coupangdata/>

웹에서는 처음 한 번 전달받은 전용 연결 링크로 열면 로그인 없이 연결됩니다. 이후에는 위 주소로 바로 열 수 있습니다. 연결 키는 검증 후 해당 브라우저에만 보관하며 주소에서 즉시 제거합니다. 연결 링크를 받지 않은 방문자에게는 판매 자료를 공개하지 않습니다.

**`판매량 분석기.html`을 더블클릭하세요.** 인터넷에 연결되어 있으면 기존 자료를 불러오고 새 자료도 서버에 저장합니다. 이 HTML 하나를 다른 폴더나 기기로 복사해도 사용할 수 있습니다. 연결 파일 선택, 로그인, 별도 프로그램 실행은 필요하지 않습니다.

`dist/index.html`도 같은 단독 실행 파일입니다. 프로젝트 루트의 `index.html`은 `dist/index.html`을 엽니다. 개발 서버가 필요한 경우에만 아래 명령 또는 기존 실행 파일을 사용합니다.

```powershell
npm install
npm start
```

HTML에는 이 분석기 자료에 한정된 접근 키가 포함됩니다. 관리자 키나 로컬 서버의 개인 키는 포함하지 않습니다. HTML을 가진 사람은 해당 분석 자료를 조회·저장·초기화할 수 있으므로 공개 배포와 구분해 보관하세요. 이 파일은 Git에서 제외됩니다. 공개 CI 빌드는 공개 프로젝트 정보만 포함하며 자료 접근 키는 포함하지 않습니다.

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

## 데이터 저장

HTML로 연 분석기는 서버 자료를 불러오고, 업로드한 자료도 같은 서버에 저장합니다. 다른 브라우저나 기기에서도 이 HTML을 열면 별도 설정 없이 같은 자료를 볼 수 있습니다.

기존 브라우저 `localStorage`의 일별·상품별 분석 데이터는 최초 실행 시 한 번만 자동 이전합니다. 이전이 완료되기 전에는 일부 데이터만 저장되지 않도록 전체 작업을 취소하고 기존 자료를 보존합니다. `전체 데이터 초기화`는 현재 분석기 저장소를 비우며 복구 전 원본 테이블은 보존합니다.

이 브라우저에 보관된 자료는 첫 실행 시 서버에 없는 행만 자동 복사합니다. 복사가 중단되면 원본을 보존하고 다음 실행에서 다시 시도합니다. 서버 장애 시 저장 성공으로 대신 표시하거나 로컬에 조용히 분리 저장하지 않습니다. 기존 계정의 판매 자료는 원래 프로젝트에서 복구했으며, 복구 전 테이블도 보존했습니다.

## 기존 Supabase 프로젝트와 함께 운영

기존 서비스의 테이블·정책·Auth 설정을 유지하고 아래 두 테이블과 `coupang_sales_` 접두사의 RPC만 추가합니다.

- `public.coupang_sales_daily_metrics`
- `public.coupang_sales_item_metrics`

아래는 개발·설치용 참고입니다. 사용 화면에는 연결 설정을 노출하지 않습니다. 로컬 개발 서버의 연결은 Git에서 제외되는 `supabase/connection.local`과 localhost 전용 API로 처리합니다. 단독 HTML은 별도의 `supabase/standalone-connection.local`에 준비한 분석기 전용 키로 직접 연결합니다. Vite 빌드가 이 설정만 HTML에 포함하며 로컬 서버 키는 포함하지 않습니다.

신규 설치를 준비할 때는 아래 명령으로 실행용 SQL과 비공개 연결 설정을 생성할 수 있습니다. 관리자 비밀 키나 DB 비밀번호는 사용하지 않습니다.

```powershell
node scripts/prepare-cloud-connection.mjs https://PROJECT_REF.supabase.co sb_publishable_YOUR_KEY
```

선택한 프로젝트의 SQL Editor에서 `outputs/coupang-shared-project.local.sql`을 실행합니다. 같은 이름의 객체가 이미 있으면 기존 객체를 교체하지 않고 설치를 중단합니다. 템플릿인 `supabase/shared-project.sql`은 생성기를 거쳐 사용하세요.

단독 HTML을 설치할 때는 `node scripts/prepare-standalone.mjs`로 별도의 접근 키와 `outputs/allow-standalone.local.sql`을 생성합니다. 해당 SQL은 기존 키를 유지하며 HTML 전용 키를 허용합니다. 권한 적용 후 `npm run build`를 실행하면 `dist/index.html`과 루트의 `판매량 분석기.html`이 생성됩니다. 설정 파일, 실행 SQL, 연결 권한을 포함한 HTML은 Git에서 제외됩니다. 최초 설치는 이미 준비되어 있으므로 사용자는 HTML만 열면 됩니다.

GitHub Pages는 `main`에 푸시하면 테스트 후 `npm run build -- --mode pages`로 만든 `dist-pages`를 배포합니다. 이 모드는 로컬 HTML 연결 설정을 읽지 않습니다. 공개 프로젝트 주소·Publishable key는 `supabase/public-project.json`에 보관하며, 비공개 연결 링크는 `node scripts/prepare-pages.mjs`가 Git에서 제외되는 `outputs/published-connection.local`에 생성합니다. 로컬 HTML의 `dist`와 공개 웹의 `dist-pages`는 별도로 유지합니다.

RLS는 공개 키만으로 자료를 읽거나 변경할 수 없도록 별도 접근 키를 검증합니다. RPC는 `SECURITY INVOKER`로 실행하며 기존 앱의 권한을 늘리지 않습니다. `전체 데이터 초기화`는 분석기 전용 서버 테이블만 비우며 기존 서비스 테이블과 복구 전 원본은 변경하지 않습니다.

신규 설치는 비공개 설정의 `snapshotMode: "paged"`와 `coupang_sales_read_page`를 사용합니다. 상품 자료를 날짜·옵션 ID 순서로 최대 5,000건씩 읽어 서버의 요청별 시간 제한을 피하며, 화면에는 전체 결과를 합쳐 전달합니다. 기존 계정 복구 템플릿 `supabase/recover-existing-data.sql`은 확인한 사용자 UUID를 지정하고 최초 설치 트랜잭션 안에서만 사용합니다. 대상 계정이 없거나 새 저장소가 비어 있지 않으면 복구를 중단합니다.

## 피벗 지표 기준

- 구매전환율: `주문 / 조회`
- 아이템위너 비율: 상품이 여러 옵션으로 묶일 때 조회수 기준 가중평균
- 취소율: `총 취소 상품수 / 총 판매수`
- 쿠팡 원본의 취소 금액 및 수량은 음수로 제공되므로 화면에서는 취소 규모를 알기 쉽게 절대값으로 표시합니다.

## 검증

```powershell
npm test
npm run build
```
