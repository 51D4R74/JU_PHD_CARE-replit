/**
 * TeamProgressArc — animated SVG ring showing aggregate team challenge progress.
 *
 * Props: progressPct (0–100), milestones array, size, children (center content).
 * Uses framer-motion for arc animation and milestone markers.
 */

import { motion } from "framer-motion";
import type { MilestoneThreshold } from "@/lib/team-challenge-engine";

interface TeamProgressArcProps {
  readonly progressPct: number;
  readonly milestones: MilestoneThreshold[];
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly children?: React.ReactNode;
  readonly className?: string;
}

// Arc color transitions based on progress tier
function getArcColor(pct: number): string {
  if (pct >= 100) return "hsl(var(--brand-gold))";
  if (pct >= 75) return "hsl(var(--score-good))";
  if (pct >= 50) return "hsl(var(--brand-teal))";
  if (pct >= 25) return "hsl(var(--score-moderate))";
  return "hsl(var(--muted-foreground))";
}

export default function TeamProgressArc({
  progressPct,
  milestones,
  size = 200,
  strokeWidth = 12,
  children,
  className,
}: TeamProgressArcProps) {
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * Math.min(progressPct, 100)) / 100;

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Progresso do desafio: ${Math.min(progressPct, 100)}%`}>
        {/* Track ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          opacity={0.2}
        />

        {/* Progress ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getArcColor(progressPct)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Milestone markers */}
        {milestones.map((m) => {
          const angle = (m.pct / 100) * 360 - 90; // -90 to start from top
          const rad = (angle * Math.PI) / 180;
          const mx = center + radius * Math.cos(rad);
          const my = center + radius * Math.sin(rad);

          return (
            <g key={m.pct}>
              <circle
                cx={mx}
                cy={my}
                r={m.reached ? 6 : 4}
                fill={m.reached ? "hsl(var(--brand-gold))" : "hsl(var(--muted-foreground))"}
                stroke="white"
                strokeWidth={2}
              />
              {m.reached && (
                <motion.circle
                  cx={mx}
                  cy={my}
                  r={6}
                  fill="none"
                  stroke="hsl(var(--brand-gold))"
                  strokeWidth={1.5}
                  initial={{ r: 6, opacity: 0.8 }}
                  animate={{ r: 12, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Center content */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
