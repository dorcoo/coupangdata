interface WinnerBadgeProps {
  value: number;
}

export default function WinnerBadge({ value }: WinnerBadgeProps) {
  const state = value >= 100 ? "safe" : value >= 90 ? "warning" : "danger";
  return (
    <span className={`winner-badge ${state}`}>
      {value.toFixed(1)}%
    </span>
  );
}
