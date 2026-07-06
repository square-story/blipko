import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string; // Tailwind text color class, e.g. "text-emerald-500"
  className?: string;
}

export function CircularProgress({
  value,
  size = 64,
  strokeWidth = 6,
  color = "text-primary",
  className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-500 ease-out", color)}
        />
      </svg>
      <span className={cn("absolute text-[11px] font-bold", color)}>
        {Math.round(value)}%
      </span>
    </div>
  );
}
