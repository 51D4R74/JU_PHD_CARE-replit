import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { devNow } from "@shared/dev-clock";
import { CaretLeft, TrendUp, TrendDown, Minus, CalendarBlank } from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import ConstancyDots from "@/components/constancy-dots";
import InsightCard from "@/components/insight-card";
import { computeTagCloud, DOMAIN_COLORS } from "@/lib/score-engine";
import { computeDiscoveries } from "@/lib/discovery-engine";
import { POINT_VALUES } from "@/lib/mission-engine";
import { useAuth } from "@/lib/auth";
import type { ScoreDomainId } from "@/lib/checkin-data";
import type { CheckInHistoryRecord, UserMission } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────

type ReportPeriod = "week" | "month";

const PERIOD_DAYS: Record<ReportPeriod, number> = { week: 7, month: 30 };

const DOMAIN_LABELS: Record<ScoreDomainId, string> = {
  recarga: "Energia",
  "estado-do-dia": "Seu dia",
  "seguranca-relacional": "Clima",
};

// ── Helpers ───────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

const TREND_THRESHOLD = 3;

function TrendIcon({ delta }: Readonly<{ delta: number }>) {
  if (delta > TREND_THRESHOLD) return <TrendUp className="w-4 h-4 text-score-good" weight="bold" />;
  if (delta < -TREND_THRESHOLD) return <TrendDown className="w-4 h-4 text-score-critical" weight="bold" />;
  return <Minus className="w-4 h-4 text-muted-foreground" weight="bold" />;
}

function ScoreStat({
  label,
  value,
  delta,
  color,
}: Readonly<{
  label: string;
  value: number;
  delta: number;
  color: string;
}>) {
  return (
    <div className="flex-1 text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <TrendIcon delta={delta} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: Readonly<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl p-3 border border-border/30 text-xs shadow-md">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 mb-0.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-foreground">
            {DOMAIN_LABELS[p.name as ScoreDomainId] ?? p.name}:{" "}
            <strong>{p.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────

export default function ReportPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const days = PERIOD_DAYS[period];

  const { data: allHistory = [] } = useQuery<CheckInHistoryRecord[]>({
    queryKey: ["/api/checkins/user", user?.id ?? "", "history"],
    enabled: !!user?.id,
  });

  const { data: todayMissions = [] } = useQuery<UserMission[]>({
    queryKey: ["/api/missions", user?.id ?? "", "today"],
    enabled: !!user?.id,
  });

  // Period records = last N days from server history
  const records = useMemo(() => {
    const cutoff = devNow();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    return allHistory.filter((r) => r.date >= cutoffDate);
  }, [allHistory, days]);

  // Previous period records for trend arrows
  const prevRecords = useMemo(() => {
    const cutoff = devNow();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const prevCutoff = devNow();
    prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const prevCutoffDate = prevCutoff.toISOString().slice(0, 10);
    return allHistory.filter((r) => r.date >= prevCutoffDate && r.date < cutoffDate);
  }, [allHistory, days]);

  const tagCloud = useMemo(
    () => computeTagCloud(records),
    [records],
  );
  const discoveries = useMemo(() => computeDiscoveries(allHistory), [allHistory]);

  // Points: check-in base + mission completions (all from server truth)
  const today = devNow().toISOString().slice(0, 10);
  const hasCheckedInToday = allHistory.some((r) => r.date === today);
  const missionPointsToday = todayMissions.reduce((sum, m) => sum + m.pointsEarned, 0);
  const points = (hasCheckedInToday ? POINT_VALUES.checkin : 0) + missionPointsToday;

  // Score averages for period
  const avgScores = useMemo<Record<ScoreDomainId, number>>(
    () => ({
      recarga: mean(records.map((r) => r.domainScores.recarga)),
      "estado-do-dia": mean(records.map((r) => r.domainScores["estado-do-dia"])),
      "seguranca-relacional": mean(
        records.map((r) => r.domainScores["seguranca-relacional"]),
      ),
    }),
    [records],
  );

  const prevAvg = useMemo<Record<ScoreDomainId, number>>(
    () => ({
      recarga: mean(prevRecords.map((r) => r.domainScores.recarga)),
      "estado-do-dia": mean(
        prevRecords.map((r) => r.domainScores["estado-do-dia"]),
      ),
      "seguranca-relacional": mean(
        prevRecords.map((r) => r.domainScores["seguranca-relacional"]),
      ),
    }),
    [prevRecords],
  );

  const chartData = useMemo(
    () =>
      [...records]
        .reverse()
        .map((r) => ({
          date: r.date.slice(5).replace("-", "/"),
          recarga: r.domainScores.recarga,
          "estado-do-dia": r.domainScores["estado-do-dia"],
          "seguranca-relacional": r.domainScores["seguranca-relacional"],
        })),
    [records],
  );

  const periodLabel = period === "week" ? "última semana" : "último mês";

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-navy/4 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-4 max-w-lg mx-auto flex items-center justify-between">
        <button
          onClick={() => navigate("/meu-cuidado")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretLeft className="w-4 h-4" weight="bold" />
          Meu Cuidado
        </button>
        <div className="flex items-center gap-1 text-muted-foreground">
          <CalendarBlank className="w-4 h-4" weight="bold" />
          <span className="text-xs capitalize">{periodLabel}</span>
        </div>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-28">
        {/* Title + period toggle */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold">Seu Relatório</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {records.length} check-in{records.length === 1 ? "" : "s"} na {periodLabel}.
            </p>
          </div>
          <div className="flex rounded-xl border border-border/40 overflow-hidden text-xs mt-1">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  period === p
                    ? "bg-brand-navy text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "week" ? "7d" : "30d"}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Score summary ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-2xl p-4 mb-4"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Suas médias no período
          </p>
          {records.length > 0 ? (
            <div className="flex gap-4">
              {(Object.keys(DOMAIN_COLORS) as ScoreDomainId[]).map((d) => (
                <ScoreStat
                  key={d}
                  label={DOMAIN_LABELS[d]}
                  value={avgScores[d]}
                  delta={avgScores[d] - prevAvg[d]}
                  color={DOMAIN_COLORS[d]}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum check-in nesse período ainda.
            </p>
          )}
        </motion.section>

        {/* ── Points summary ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-4 mb-4"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Lumens — hoje
          </p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-brand-gold">{points}</span>
            <span className="text-sm text-muted-foreground">pontos totais</span>
          </div>
        </motion.section>

        {/* ── Score trend chart ── */}
        {chartData.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-2xl p-4 mb-4"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Evolução
            </p>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border) / 0.3)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {(Object.keys(DOMAIN_COLORS) as ScoreDomainId[]).map((d) => (
                    <Line
                      key={d}
                      type="monotone"
                      dataKey={d}
                      stroke={DOMAIN_COLORS[d]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}

        {/* ── Constancy ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-4 mb-4"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Constância — seus últimos 10 dias
          </p>
          <ConstancyDots days={10} checkedInDates={allHistory.map((r) => r.date)} />
        </motion.section>

        {/* ── Top tags ── */}
        {tagCloud.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card rounded-2xl p-4 mb-4"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              O que mais apareceu
            </p>
            <div className="space-y-2">
              {tagCloud.slice(0, 5).map((tag, i) => (
                <div key={tag.flag} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-teal rounded-full"
                      style={{
                        width: `${(tag.count / (tagCloud[0]?.count || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium min-w-[100px]">
                    {tag.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{tag.count}×</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Discoveries ── */}
        {discoveries.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendUp className="w-4 h-4 text-brand-teal" weight="bold" />
              <h2 className="text-sm font-semibold">Descobertas</h2>
            </div>
            <div className="space-y-3">
              {discoveries.map((d) => (
                <InsightCard key={d.id} discovery={d} />
              ))}
            </div>
          </motion.section>
        )}

        <div className="privacy-note mt-2 mb-4">
          Dados visíveis apenas para você. Nenhuma informação é compartilhada com sua empresa.
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
