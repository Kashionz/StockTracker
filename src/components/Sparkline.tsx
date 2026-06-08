import type { TrendTone } from "../types";

interface SparklineProps {
  points: number[];
  trend: TrendTone;
}

export function Sparkline({ points, trend }: SparklineProps) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg className={`sparkline sparkline-${trend}`} viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d={path} fill="none" pathLength={100} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
