import type { View } from "../../types";

interface SidebarProps {
  view: View;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (view: View) => void;
}

export default function Sidebar({ view, collapsed, onToggle, onSelect }: SidebarProps) {
  const entries: Array<[View, string, string]> = [
    ["dashboard", "▦", "요약 대시보드"],
    ["trend", "◫", "일별/월별 추이"],
    ["categories", "◔", "카테고리 비중"],
    ["winner", "!", "아이템위너 위험"],
    ["products", "▣", "상품/옵션 실적"],
    ["pivot", "▤", "피벗 테이블 분석"],
  ];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? "사이드 메뉴 펼치기" : "사이드 메뉴 접기"}
        title={collapsed ? "사이드 메뉴 펼치기" : "사이드 메뉴 접기"}
      >
        <span>{collapsed ? "›" : "‹"}</span>
        <b>{collapsed ? "" : "메뉴 접기"}</b>
      </button>
      <p className="side-title">데이터 관리</p>
      <button
        type="button"
        className={view === "import" ? "active" : ""}
        onClick={() => onSelect("import")}
        title="파일 클라우드 업로드"
      >
        <span>↥</span><b>파일 클라우드 업로드</b>
      </button>
      <div className="side-divider" />
      <p className="side-title">분석 뷰 선택</p>
      {entries.map(([key, icon, label]) => (
        <button
          key={key}
          type="button"
          className={view === key ? "active" : ""}
          onClick={() => onSelect(key)}
          title={label}
        >
          <span>{icon}</span><b>{label}</b>
        </button>
      ))}
      <div className="side-divider" />
      <button
        type="button"
        className={view === "setup" ? "active" : ""}
        onClick={() => onSelect("setup")}
        title="Supabase 설정"
      >
        <span>⚙</span><b>Supabase 설정</b>
      </button>
    </aside>
  );
}
