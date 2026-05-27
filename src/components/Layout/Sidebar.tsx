import type { View } from "../../types";

interface SidebarProps {
  view: View;
  onSelect: (view: View) => void;
}

export default function Sidebar({ view, onSelect }: SidebarProps) {
  const entries: Array<[View, string, string]> = [
    ["dashboard", "▦", "요약 대시보드"],
    ["trend", "◫", "일별/월별 추이"],
    ["categories", "◔", "카테고리 비중"],
    ["winner", "!", "아이템위너 위험"],
    ["products", "▣", "상품/옵션 실적"],
    ["pivot", "▤", "피벗 테이블 분석"],
  ];

  return (
    <aside className="sidebar">
      <p className="side-title">데이터 관리</p>
      <button
        type="button"
        className={view === "import" ? "active" : ""}
        onClick={() => onSelect("import")}
      >
        <span>↥</span>파일 클라우드 업로드
      </button>
      <div className="side-divider" />
      <p className="side-title">분석 뷰 선택</p>
      {entries.map(([key, icon, label]) => (
        <button
          key={key}
          type="button"
          className={view === key ? "active" : ""}
          onClick={() => onSelect(key)}
        >
          <span>{icon}</span>{label}
        </button>
      ))}
      <div className="side-divider" />
      <button
        type="button"
        className={view === "setup" ? "active" : ""}
        onClick={() => onSelect("setup")}
      >
        <span>⚙</span>Supabase 설정
      </button>
    </aside>
  );
}
