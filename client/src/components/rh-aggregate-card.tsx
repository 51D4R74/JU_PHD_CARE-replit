/**
 * RH aggregate card — reusable stat/metric card for the RH dashboard.
 *
 * Supports: plain number, percentage, trend indicator, colored severity.
 */

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface RHAggregateCardProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | number;
  readonly subtitle?: string;
  readonly trend?: { direction: "up" | "down" | "flat"; value: string };
  readonly trendPositive?: "up" | "down"; // which direction is "good"
  readonly className?: string;
  readonly delay?: number;
}

export default function RHAggregateCard({
  icon,
  label,
  value,
  subtitle,
  trend,
  trendPositive = "up",
  className,
  delay = 0,
}: Readonly<RHAggregateCardProps>) {
  const trendColor = (() => {
    if (!trend) return "";
    if (trend.direction === "flat") return "text-muted-foreground";
    const isGood = trend.direction === trendPositive;
    return isGood ? "text-score-good" : "text-score-critical";
  })();

  function trendIcon() {
    if (trend?.direction === "up") return TrendingUp;
    if (trend?.direction === "down") return TrendingDown;
    return Minus;
  }
  const TrendIcon = trendIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-xl border border-border-soft bg-white p-5 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        {icon}
        {trend && (
          <span className={`text-xs flex items-center gap-0.5 ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>
      )}
    </motion.div>
  );
}
