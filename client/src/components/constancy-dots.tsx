/**
 * ConstancyDots — last 10 days of check-in constancy as mini icons.
 * Sun (gold)  = checked in, composite score > 50.
 * Cloud (teal) = checked in, composite score ≤ 50.
 * Cloud (gray) = missed (no check-in).
 *
 * Derives constancy from `checkedInHistory` (full server history records).
 * Also exports `computeStreak` for use by the dashboard greeting.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sun, Cloud, Flame } from "@phosphor-icons/react";
import { devNow } from "@shared/dev-clock";
import type { CheckInHistoryRecord } from "@shared/schema";

type DayState = "sunny" | "cloudy" | "missed";

interface ConstancyDotsProps {
  readonly days?: number;
  readonly className?: string;
  readonly variant?: "default" | "hero";
  /** Full check-in history records from server. */
  readonly checkedInHistory: ReadonlyArray<CheckInHistoryRecord>;
}

const STREAK_MILESTONES = [30, 14, 7, 3] as const;

function streakRingClass(hasAurora: boolean, hasHalo: boolean): string {
  if (hasAurora) {
    return " aurora-streak ring-2 ring-brand-gold/40 shadow-[0_0_16px_hsl(var(--brand-gold)/0.3)]";
  }
  if (hasHalo) {
    return " ring-2 ring-brand-gold/30 shadow-[0_0_12px_hsl(var(--brand-gold)/0.25)]";
  }
  return "";
}

function getWeekdayInitial(date: Date): string {
  const weekday = date.getDay();
  const initials = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
  return initials[weekday] ?? "-";
}

function compositeScore(domainScores: CheckInHistoryRecord["domainScores"]): number {
  return Math.round(
    (domainScores.recarga +
      domainScores["estado-do-dia"] +
      domainScores["seguranca-relacional"]) / 3,
  );
}

function deriveConstancy(days: number, checkedInHistory: ReadonlyArray<CheckInHistoryRecord>) {
  const scoreMap = new Map<string, CheckInHistoryRecord["domainScores"]>(
    checkedInHistory.map((r) => [r.date, r.domainScores]),
  );
  const now = devNow();
  const result: { date: string; state: DayState; weekdayInitial: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const scores = scoreMap.get(key);
    let state: DayState;
    if (!scores) {
      state = "missed";
    } else {
      state = compositeScore(scores) > 50 ? "sunny" : "cloudy";
    }
    result.push({ date: key, state, weekdayInitial: getWeekdayInitial(d) });
  }
  return result;
}

function HeroConstancyClouds({
  ordered,
  streak,
  className,
}: Readonly<{
  ordered: ReadonlyArray<{ date: string; state: DayState; weekdayInitial: string }>;
  streak: number;
  className: string;
}>) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`.trim()}>
      <div className="inline-flex items-end gap-2 rounded-[22px] border border-border/40 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
        {ordered.map((day, index) => {
          const itemClass =
            day.state !== "missed" ? "text-foreground" : "text-muted-foreground/50";

          return (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.24 }}
              title={`${day.date} — ${day.state === "missed" ? "Sem check-in" : "Check-in feito"}`}
              className="flex min-w-6 flex-col items-center gap-1"
            >
              <span className={`text-[10px] font-semibold leading-none ${itemClass}`}>
                {day.weekdayInitial}
              </span>
              <div className="relative flex h-5 w-5 items-center justify-center">
                {day.state === "sunny" ? (
                  <Sun className="h-4 w-4 text-brand-gold" weight="fill" />
                ) : day.state === "cloudy" ? (
                  <Cloud className="h-4 w-4 text-slate-500" weight="fill" />
                ) : (
                  <Cloud className="h-4 w-4 fill-current text-muted-foreground/40" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {streak > 1 ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 text-[11px] font-semibold text-white/90"
        >
          <Flame className="h-3.5 w-3.5 text-brand-gold" />
          <span>{streak} dias seguidos</span>
        </motion.div>
      ) : null}
    </div>
  );
}

/** Count consecutive check-in days ending today (or yesterday). */
export function computeStreak(checkedInHistory: ReadonlyArray<CheckInHistoryRecord>): number {
  const dateSet = new Set(checkedInHistory.map((r) => r.date));
  const now = devNow();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dateSet.has(key)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default function ConstancyDots({
  days = 10,
  className = "",
  variant = "default",
  checkedInHistory,
}: Readonly<ConstancyDotsProps>) {
  const constancy = useMemo(
    () => deriveConstancy(days, checkedInHistory),
    [days, checkedInHistory],
  );
  // Reverse to show oldest → newest (left to right)
  const ordered = [...constancy].reverse();

  const streak = useMemo(() => computeStreak(checkedInHistory), [checkedInHistory]);
  const milestone = STREAK_MILESTONES.find((m) => streak >= m);
  const hasHalo = streak >= 7;
  const hasAurora = streak >= 14;

  if (variant === "hero") {
    return <HeroConstancyClouds ordered={ordered} streak={streak} className={className} />;
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className={
          "flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 shadow-sm transition-shadow duration-500" +
          streakRingClass(hasAurora, hasHalo)
        }
      >
        {ordered.map((day, i) => (
          <motion.div
            key={day.date}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            title={`${day.date} — ${day.state === "missed" ? "Sem check-in" : "Check-in feito"}`}
            className="flex items-center justify-center"
          >
            {day.state === "sunny" ? (
              <Sun className="h-3.5 w-3.5 text-brand-gold-dark" />
            ) : day.state === "cloudy" ? (
              <Cloud className="h-3.5 w-3.5 text-slate-500" weight="fill" />
            ) : (
              <Cloud className="h-3.5 w-3.5 text-muted-foreground/45" />
            )}
          </motion.div>
        ))}
      </div>
      {milestone ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 text-[11px] font-semibold text-brand-gold-dark"
        >
          <Flame className="h-3.5 w-3.5" />
          <span>{streak} dias seguidos</span>
        </motion.div>
      ) : null}
    </div>
  );
}
