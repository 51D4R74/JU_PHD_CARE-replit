import { useState, useMemo, useReducer, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { devNow } from "@shared/dev-clock";
import { CaretLeft, CaretRight, Star, TrendUp, FileText, Heart, Lightning, SunHorizon, Handshake, Sparkle, ChatCircleDots } from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import ConstancyDots from "@/components/constancy-dots";
import InsightCard from "@/components/insight-card";
import JuPHDChatCard from "@/components/juphd-chat-card";
import WellnessReadinessCard from "@/components/wellness-readiness-card";
import SupportMessageCard from "@/components/support-message-card";
import { computeTagCloud, DOMAIN_COLORS, getDomainMeta, getDomainNarrative, DOMAIN_WARM_NAMES, type TagCount, type TodayScores } from "@/lib/score-engine";
import type { ScoreDomainId } from "@/lib/checkin-data";
import { computeDiscoveries, daysUntilDiscovery, DISCOVERY_MIN_RECORDS } from "@/lib/discovery-engine";
import { getFavoriteMessages, toggleFavorite, isFavorite } from "@/lib/support-engine";
import { useAuth } from "@/lib/auth";
import type { CheckInHistoryRecord } from "@shared/schema";
import { fetchCurrentRelationalPulse } from "@/lib/pulse-client";
import { PULSE_DIMENSION_LABELS, type CurrentPulseState, type PulseDimension } from "@shared/pulse-survey";

// ── Chart config ────────────────────────────────────────────

const DOMAIN_LABELS: Record<ScoreDomainId, string> = {
  recarga: "Energia",
  "estado-do-dia": "Seu dia",
  "seguranca-relacional": "Clima",
};

// ── Custom tooltip ────────────────────────────────

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
            {DOMAIN_LABELS[p.name as ScoreDomainId] ?? p.name}: <strong>{p.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tag pill ──────────────────────────────────────

function TagPill({ tag }: Readonly<{ tag: TagCount }>) {
  const intensity = Math.min(tag.count, 6);
  const fontSize = 11 + intensity;
  const px = 12 + intensity * 2;
  const py = 6 + Math.trunc(intensity / 2);
  const opacity = 0.3 + intensity * 0.08;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center rounded-full font-medium border border-border/40 ${intensity >= 4 ? "shadow-sm" : ""}`}
      style={{
        fontSize: `${fontSize}px`,
        padding: `${py}px ${px}px`,
        backgroundColor: `rgba(26, 54, 93, ${opacity})`,
      }}
    >
      {tag.label}
    </motion.span>
  );
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

const DOMAIN_EXPLANATIONS: Record<ScoreDomainId, {
  icon: typeof Lightning;
  warmName: string;
  whatItMeasures: string;
  fromQuestions: string;
  example: string;
}> = {
  recarga: {
    icon: Lightning,
    warmName: "Sua energia",
    whatItMeasures: "Mede a qualidade do sono e o nível de disposição que você sente no dia.",
    fromQuestions: "Vem das perguntas \"Como você dormiu?\" e \"Como tá a energia?\"",
    example: "Bateria cheia — dia bom pra avançar",
  },
  "estado-do-dia": {
    icon: SunHorizon,
    warmName: "Seu dia",
    whatItMeasures: "Captura como você está emocionalmente e o impacto que o dia deixa em você.",
    fromQuestions: "Vem das perguntas \"Como tá se sentindo?\" e \"Como o dia te deixou?\"",
    example: "Dia luminoso — aproveite",
  },
  "seguranca-relacional": {
    icon: Handshake,
    warmName: "O clima ao redor",
    whatItMeasures: "Avalia como está o ambiente entre você e as pessoas ao redor — apoio, neutralidade ou tensão.",
    fromQuestions: "Vem da pergunta \"Como foi o clima ao seu redor?\"",
    example: "Clima tranquilo — bom pra conexões",
  },
};

const EMPTY_SCORES: TodayScores = {
  domainScores: { recarga: 0, "estado-do-dia": 0, "seguranca-relacional": 0 },
  skyState: "partly-cloudy",
  solarHaloLevel: 0.5,
  flags: [],
  hasCheckedIn: false,
};

// ── Page ──────────────────────────────────────────

function getPulseDimensionIcon(dim: PulseDimension) {
  if (dim === "pressure_predictability") return Lightning;
  if (dim === "support_care") return Heart;
  if (dim === "peer_relations") return Handshake;
  return Sparkle;
}

function getPulseScoreLabel(score: number): { label: string; colorClass: string; bgClass: string; barClass: string } {
  if (score >= 75) return { label: "Ótimo", colorClass: "text-score-good", bgClass: "bg-score-good/12", barClass: "bg-score-good" };
  if (score >= 50) return { label: "Bom", colorClass: "text-score-moderate", bgClass: "bg-score-moderate/12", barClass: "bg-score-moderate" };
  if (score >= 25) return { label: "Regular", colorClass: "text-score-attention", bgClass: "bg-score-attention/12", barClass: "bg-score-attention" };
  return { label: "Baixo", colorClass: "text-score-critical", bgClass: "bg-score-critical/12", barClass: "bg-score-critical" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

export default function MeuCuidadoPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();
  const [range, setRange] = useState<7 | 30>(7);
  const domainsSectionRef = useRef<HTMLDivElement>(null);
  const pulseSectionRef = useRef<HTMLDivElement>(null);

  // Server-canonical check-in history — primary data source
  const { data: allHistory = [] } = useQuery<CheckInHistoryRecord[]>({
    queryKey: ["/api/checkins/user", user?.id ?? "", "history"],
    enabled: !!user?.id,
  });

  // Today's scores for domain cards
  const { data: scores = EMPTY_SCORES } = useQuery<TodayScores>({
    queryKey: ["/api/scores/user", user?.id ?? "", "today"],
    enabled: !!user?.id,
  });

  // Pulse state for the pulse section
  const { data: pulseState } = useQuery<CurrentPulseState>({
    queryKey: ["/api/pulses/user", user?.id ?? "", "current"],
    queryFn: () => fetchCurrentRelationalPulse(user!.id),
    enabled: !!user?.id,
  });

  const domains = getDomainMeta();

  // Client-side range filter (no re-fetch needed)
  const records = useMemo(() => {
    const cutoff = devNow();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    return allHistory.filter((r) => r.date >= cutoffDate);
  }, [allHistory, range]);

  const tagCloud = useMemo(
    () => computeTagCloud(allHistory.slice(-30)),
    [allHistory],
  );
  const [, forceFavUpdate] = useReducer((x: number) => x + 1, 0);
  const favorites = getFavoriteMessages();

  const discoveries = useMemo(
    () => computeDiscoveries(allHistory),
    [allHistory],
  );
  const daysLeft = daysUntilDiscovery(allHistory.length);
  const hasEnoughData = allHistory.length >= DISCOVERY_MIN_RECORDS;

  // Chart data: oldest → newest
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

  const hasChartData = chartData.length > 0;

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const section = params.get("section");
    if (section === "domains" && domainsSectionRef.current) {
      const timeout = setTimeout(() => {
        domainsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
      return () => clearTimeout(timeout);
    }
    if (section === "pulse" && pulseSectionRef.current) {
      const timeout = setTimeout(() => {
        pulseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [searchString]);

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-teal/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-4 max-w-lg mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretLeft className="w-4 h-4" weight="bold" />
          Voltar ao início
        </button>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-28">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold">Meu Cuidado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Como você tem se cuidado ao longo do tempo.
          </p>
        </motion.div>

        {/* ── Domain explainer ── */}
        <motion.section
          ref={domainsSectionRef}
          id="domains"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkle className="w-4 h-4 text-brand-teal" weight="fill" />
            <h2 className="text-sm font-semibold">Seus sinais de bem-estar</h2>
          </div>

          <div className="space-y-2">
            {(Object.keys(DOMAIN_EXPLANATIONS) as ScoreDomainId[]).map((domainId) => {
              const info = DOMAIN_EXPLANATIONS[domainId];
              const Icon = info.icon;
              return (
                <div
                  key={domainId}
                  className="rounded-2xl border border-border/40 bg-card px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${DOMAIN_COLORS[domainId]}20` }}
                    >
                      <Icon
                        className="h-4 w-4"
                        weight="bold"
                        style={{ color: DOMAIN_COLORS[domainId] }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {info.warmName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {info.whatItMeasures}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {info.fromQuestions}
                      </p>
                      <p className="text-[11px] italic text-muted-foreground/60 mt-1">
                        Ex: "{info.example}"
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-brand-teal/15 bg-brand-teal/5 px-4 py-3">
            <p className="text-xs leading-relaxed text-foreground/80">
              Com {DISCOVERY_MIN_RECORDS}+ check-ins, a Lumina começa a cruzar esses sinais com o contexto do seu dia — e gera <strong>descobertas privadas</strong> como <em>"Nos dias com exercício, sua energia tende a ficar melhor."</em>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Só você vê. Nenhum número bruto aparece — apenas frases que ajudam você a se entender melhor.
            </p>
          </div>
        </motion.section>

        {/* ── Constancy ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-2xl p-4 mb-4"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Constância — seus últimos 10 dias
          </p>
          <ConstancyDots days={10} checkedInDates={allHistory.map((r) => r.date)} />
          <p className="text-xs text-muted-foreground mt-2">
            {allHistory.length === 0
              ? "Faça seu primeiro check-in pra começar."
              : `${allHistory.length} check-in${plural(allHistory.length, "", "s")} no total.`}
          </p>
        </motion.section>

        {/* ── Wellness readiness panel (Oura-inspired) ── */}
        {scores.hasCheckedIn && (
          <WellnessReadinessCard scores={scores} />
        )}

        {/* ── Wellness narrative — today's story ── */}
        {scores.hasCheckedIn && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-4 space-y-2"
          >
            {domains.map((d) => {
              const score = scores.domainScores[d.id] ?? 0;
              const narrative = getDomainNarrative(d.id, score);
              const scoreBorderClass = score >= 75 ? "card-score-good" : score >= 50 ? "card-score-moderate" : score >= 25 ? "card-score-attention" : "card-score-critical";
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3 ${scoreBorderClass}`}
                >
                  <span className="text-lg flex-shrink-0" role="img" aria-hidden="true">
                    {narrative.emoji}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      {DOMAIN_WARM_NAMES[d.id]}
                    </span>
                    <p className="text-sm font-medium leading-snug text-foreground mt-0.5">
                      {narrative.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </motion.section>
        )}

        {/* ── Score trend chart ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-4 mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Seu cuidado ao longo do tempo
            </p>
            <div className="flex rounded-xl border border-border/40 overflow-hidden text-xs">
              {([7, 30] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 transition-colors font-medium ${
                    range === r
                      ? "bg-brand-navy text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {/* Chart legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            {(Object.keys(DOMAIN_COLORS) as ScoreDomainId[]).map((d) => (
              <div key={d} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: DOMAIN_COLORS[d] }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {DOMAIN_LABELS[d]}
                </span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {hasChartData ? (
              <motion.div
                key={`chart-${range}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ height: 160 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      {(Object.keys(DOMAIN_COLORS) as ScoreDomainId[]).map((d) => (
                        <linearGradient key={d} id={`fill-${d}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={DOMAIN_COLORS[d]} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={DOMAIN_COLORS[d]} stopOpacity={0.03} />
                        </linearGradient>
                      ))}
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {(Object.keys(DOMAIN_COLORS) as ScoreDomainId[]).map((d) => (
                      <Area
                        key={d}
                        type="monotone"
                        dataKey={d}
                        stroke={DOMAIN_COLORS[d]}
                        strokeWidth={2}
                        fill={`url(#fill-${d})`}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            ) : (
              <motion.div
                key="chart-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-[100px] text-muted-foreground text-sm"
              >
                Nada registrado nesse período ainda.
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── Pulse mensal ── */}
        {pulseState && (
          <motion.section
            ref={pulseSectionRef}
            id="pulse"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <ChatCircleDots className="w-4 h-4 text-brand-teal" weight="fill" />
              <h2 className="text-sm font-semibold">Pulse relacional mensal</h2>
            </div>

            {pulseState.latestResponse ? (
              <div className="rounded-2xl border border-border/40 bg-card px-4 py-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground">
                    Respondida em {formatDate(pulseState.latestResponse.submittedAt)}
                  </p>
                  {(() => {
                    const { label, colorClass, bgClass } = getPulseScoreLabel(pulseState.latestResponse!.scoreSummary.overallScore);
                    return (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bgClass} ${colorClass}`}>
                        Geral {label}
                      </span>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  {(Object.entries(pulseState.latestResponse.scoreSummary.dimensionScores) as [PulseDimension, number][]).map(([dim, score]) => {
                    const Icon = getPulseDimensionIcon(dim);
                    const { label, colorClass, bgClass, barClass } = getPulseScoreLabel(score);
                    const barPct = score;
                    return (
                      <div key={dim} className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${bgClass}`}>
                          <Icon className={`h-4 w-4 ${colorClass}`} weight="bold" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-foreground leading-none">
                              {PULSE_DIMENSION_LABELS[dim]}
                            </p>
                            <p className={`text-[11px] font-semibold ${colorClass}`}>{label}</p>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-border/30 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barClass}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/40 bg-card px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center flex-shrink-0">
                  <ChatCircleDots className="w-5 h-5 text-brand-teal" weight="fill" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pesquisa disponível</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Responda no dashboard para ver seus resultados aqui.
                  </p>
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* ── Discoveries ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendUp className="w-4 h-4 text-brand-teal" weight="bold" />
            <h2 className="text-sm font-semibold">Suas descobertas</h2>
          </div>

          {hasEnoughData && discoveries.length > 0 ? (
            <div className="space-y-3">
              {discoveries.map((d) => (
                <InsightCard key={d.id} discovery={d} />
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-4 border border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center flex-shrink-0">
                  <TrendUp className="w-5 h-5 text-brand-teal" weight="bold" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {daysLeft > 0
                      ? `${daysLeft} dia${plural(daysLeft, "", "s")} para sua primeira descoberta`
                      : "Continue fazendo check-ins pra novas descobertas."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Precisamos de {DISCOVERY_MIN_RECORDS} dias com contextos pra detectar padrões.
                  </p>
                </div>
              </div>
              {daysLeft > 0 && (
                <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-teal rounded-full transition-all"
                    style={{
                      width: `${((DISCOVERY_MIN_RECORDS - daysLeft) / DISCOVERY_MIN_RECORDS) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </motion.section>

        {allHistory.length >= 3 && (
          <JuPHDChatCard
            message="Vi seus registros recentes. Quer conversar sobre o que percebeu?"
            delay={0.22}
            className="mb-4"
          />
        )}

        {/* ── Tag cloud ── */}
        {tagCloud.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              O que mais aparece — últimos 30 dias
            </p>
            <div className="flex flex-wrap gap-2">
              {tagCloud.map((tag) => (
                <TagPill key={tag.flag} tag={tag} />
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Weekly report CTA ── */}
        <motion.button
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/report")}
          className="w-full glass-card rounded-2xl p-4 border border-brand-navy/15 flex items-center gap-3 text-left hover:border-brand-navy/30 transition-colors mb-4"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-brand-navy" weight="fill" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Ver Seu Relatório</p>
            <p className="text-xs text-muted-foreground">Resumo semanal e mensal do seu cuidado</p>
          </div>
          <CaretRight className="w-4 h-4 text-muted-foreground" weight="bold" />
        </motion.button>

        {/* ── Favorite messages ── */}
        {favorites.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-brand-gold" weight="fill" />
              <h2 className="text-sm font-semibold">Mensagens favoritas</h2>
            </div>
            <div className="space-y-3">
              {favorites.slice(0, 3).map((msg) => (
                <SupportMessageCard
                  key={msg.id}
                  message={msg}
                  isFavorite={isFavorite(msg.id)}
                  onToggleFavorite={(id) => { toggleFavorite(id); forceFavUpdate(); }}
                />
              ))}
            </div>
          </motion.section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
