import type { SortDirection } from "../../lib/analyticsHelper";

interface SortHeaderProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}

export default function SortHeader({
  label,
  active,
  direction,
  onClick,
  className = "",
}: SortHeaderProps) {
  return (
    <th className={className}>
      <button type="button" className={`sort-header ${active ? "active" : ""}`} onClick={onClick}>
        {label}
        <span>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}
