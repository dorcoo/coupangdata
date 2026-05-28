export const currentConversationHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>쿠팡 판매량 분석 대화 기록</title>
<style>
body{font-family:Arial,"Malgun Gothic",sans-serif;background:#f7f8fa;color:#162032;margin:0;padding:32px}
main{max-width:820px;margin:0 auto} h1{font-size:24px;margin-bottom:6px} .date{color:#64748b;margin-bottom:28px}
.message{padding:16px 18px;border-radius:14px;margin:12px 0;line-height:1.55}
.user{background:#d9ecff;margin-left:80px}.assistant{background:white;border:1px solid #e2e8f0;margin-right:80px}
.label{font-size:12px;font-weight:bold;color:#486581;margin-bottom:6px} table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left} th{background:#f1f5f9}
</style></head>
<body><main><h1>쿠팡 판매량 분석 대화</h1><div class="date">2026-05-27</div>
<section class="message user"><div class="label">사용자</div>경로에 있는 엑셀들 확인해봐</section>
<section class="message assistant"><div class="label">Codex</div>쿠팡 판매자 인사이트 상품 지표 엑셀 3개를 확인했습니다. 세 파일 모두 vendor item metrics 형식이며, 날짜 정보는 별도 요약 파일로 매칭할 수 있습니다.</section>
<section class="message user"><div class="label">사용자</div>이거주면 각 파일 날짜 알아낼 수 있나?</section>
<section class="message assistant"><div class="label">Codex</div>일별 요약 파일과 지표 합계를 대조해 정확히 확인했습니다.
<table><thead><tr><th>상품별 파일</th><th>날짜</th><th>매출</th><th>판매량</th></tr></thead>
<tbody><tr><td>(4).xlsx</td><td>2026-05-24</td><td>2,262,440원</td><td>101</td></tr>
<tr><td>(3).xlsx</td><td>2026-05-25</td><td>1,869,700원</td><td>94</td></tr>
<tr><td>(2).xlsx</td><td>2026-05-26</td><td>2,245,670원</td><td>97</td></tr></tbody></table></section>
<section class="message user"><div class="label">사용자</div>방금 너랑 나눈 대화를 HTML로 관리하고 싶어. 각 상품별로 피벗으로 보고, Supabase를 활용해서 웹으로 관리할 수 있게 해줘.</section>
</main></body></html>`;
