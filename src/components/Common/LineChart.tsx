import { useLayoutEffect, useRef, useState } from "react";
import type { TrendPoint } from "../../types";

interface LineChartProps {
  points: TrendPoint[];
  value: (point: TrendPoint) => number;
  label: string;
  color: string;
  suffix?: string;
  fill?: boolean;
}

export default function LineChart({
  points,
  value,
  label,
  color,
  suffix = "",
  fill = false,
}: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const updateWidth = () => setPlotWidth(Math.max(1, Math.round(plot.getBoundingClientRect().width)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [points.length]);

  if (!points.length) {
    return <div className="chart-empty">표시할 일별 데이터가 없습니다.</div>;
  }

  const values = points.map(value);
  const max = Math.max(...values, 1);
  const width = plotWidth || 1100;
  const height = 235;

  // SVG 좌표 매핑
  const coordinates = values.map((entry, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (entry / max) * (height - 25); // 마진 확보
    return { x, y };
  });

  const coords = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,${height} ${coords} ${width},${height}`;

  // X축 날짜 라벨 겹침 방지 로직 (최대 7-8개만 출력되게 step 조정)
  const tickStep = Math.max(1, Math.ceil((points.length - 1) / 7));
  const ticks = points
    .map((point, index) => ({ point, index }))
    .filter(
      ({ index }) =>
        index === 0 || index === points.length - 1 || index % tickStep === 0
    );

  // 마우스 자석(Magnetic Snap) 효과 구현
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredCoord = hoverIndex !== null ? coordinates[hoverIndex] : null;

  return (
    <div className="chart">
      <div className="legend">
        <i style={{ borderColor: color, background: fill ? `${color}18` : "transparent" }} />
        {label}
      </div>
      <div className="chart-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          aria-label={`${label} 차트`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ overflow: "visible" }}
        >
          {/* 가로 보조 점선 */}
          {[1, 2, 3, 4].map((line) => (
            <line
              key={line}
              x1="0"
              x2={width}
              y1={(height / 5) * line}
              y2={(height / 5) * line}
              stroke="#e7edf3"
              strokeDasharray="3 3"
            />
          ))}

          {/* 자석 마우스 가이드 수직 점선 */}
          {hoveredCoord && (
            <line
              x1={hoveredCoord.x}
              y1="0"
              x2={hoveredCoord.x}
              y2={height}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              pointerEvents="none"
            />
          )}

          {/* 차트 면적 채우기 그라디언트 */}
          {fill && <polygon points={area} fill={`${color}14`} pointerEvents="none" />}

          {/* 꺾은선 메인 경로 */}
          <polyline
            points={coords}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            pointerEvents="none"
          />

          {/* 꺾은선 위의 둥근 마커 포인트 */}
          {coordinates.map((point, index) => (
            <circle
              key={points[index].date}
              cx={point.x}
              cy={point.y}
              r={hoverIndex === index ? 6 : 4}
              fill={hoverIndex === index ? color : "white"}
              stroke={color}
              strokeWidth="2.5"
              pointerEvents="none"
            />
          ))}

          {/* 마우스 이벤트를 캐치하는 보이지 않는 사각형 레이어 */}
          <rect
            width={width}
            height={height}
            fill="transparent"
            style={{ cursor: "crosshair" }}
          />
        </svg>

        {/* 자석 정렬 툴팁 */}
        {hoverIndex !== null && hoveredCoord && (
          <div
            className={`chart-tooltip ${hoveredCoord.y < 44 ? "below" : ""}`}
            style={{
              left: `${Math.max(6, Math.min(94, (hoveredCoord.x / width) * 100))}%`,
              top: `${(hoveredCoord.y / height) * 100}%`,
            }}
          >
            <b>{points[hoverIndex].date}</b>
            <span>
              {label}: {suffix === "%" ? values[hoverIndex].toFixed(2) : values[hoverIndex].toLocaleString("ko-KR")}
              {suffix}
            </span>
          </div>
        )}
      </div>

      {/* X축 날짜 눈금 */}
      <div className="chart-axis">
        {ticks.map(({ point, index }) => (
          <span
            key={point.date}
            className={index === 0 ? "first" : index === points.length - 1 ? "last" : ""}
            style={{
              left: `${points.length === 1 ? 50 : (index / (points.length - 1)) * 100}%`,
            }}
          >
            {point.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}
