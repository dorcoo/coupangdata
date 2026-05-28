import type { SortDirection } from "../../lib/analyticsHelper";
import type { ReactNode } from "react";

interface SortHeaderProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
  resizer?: ReactNode;
}

export default function SortHeader({
  label,
  active,
  direction,
  onClick,
  className = "",
  resizer,
}: SortHeaderProps) {
  return (
    <th className={className}>
      <button type="button" className={`sort-header ${active ? "active" : ""}`} onClick={onClick}>
        {label}
        <span>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
      {resizer}
    </th>
  );
}
