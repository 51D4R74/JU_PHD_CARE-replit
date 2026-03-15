import { motion } from "framer-motion";
import { type TodayScores } from "@/lib/score-engine";

interface Indicator {
  label: string;
  value: number;
  color: string;
}

function getAdaptivePhrase(indicators: Indicator[]): string {
  const avg = Math.round(indicators.reduce((s, i) => s + i.value, 0) / indicators.length);
  if (avg >= 75) return "Hoje parece um bom dia — aproveite a energia.";
  if (avg >= 50) return "Dia equilibrado — missões leves podem ajudar.";
  if (avg >= 25) return "Seu nível de recarga está abaixo — missões leves priorizadas hoje.";
  return "Cuide-se com calma hoje — pequenas pausas fazem diferença.";
}

function getBarColor(value: number): string {
  if (value >= 75) return "bg-score-good";
  if (value >= 50) return "bg-brand-gold";
  if (value >= 25) return "bg-score-attention";
  return "bg-score-critical";
}

function getBarTrack(value: number): string {
  if (value >= 75) return "bg-score-good/15";
  if (value >= 50) return "bg-brand-gold/15";
  if (value >= 25) return "bg-score-attention/15";
  return "bg-score-critical/15";
}

function IndicatorBar({ indicator, delay }: Readonly<{ indicator: Indicator; delay: number }>) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{indicator.label}</span>
        <span className="text-xs font-semibold text-muted-foreground">{indicator.value}</span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${getBarTrack(indicator.value)}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${indicator.value}%` }}
          transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${getBarColor(indicator.value)}`}
        />
      </div>
    </div>
  );
}

export default function WellnessReadinessCard({ scores }: Readonly<{ scores: TodayScores }>) {
  const { domainScores, flags } = scores;

  const flagPenalty = flags.length > 0 ? Math.min(flags.length * 8, 25) : 0;
  const rawEquilibrio = Math.round((domainScores["estado-do-dia"] * 0.7 + (100 - flagPenalty) * 0.3));
  const equilibrio = Math.max(0, Math.min(100, rawEquilibrio));

  const indicators: Indicator[] = [
    { label: "Energia", value: domainScores.recarga, color: "score-good" },
    { label: "Foco", value: domainScores["estado-do-dia"], color: "brand-gold" },
    { label: "Equilíbrio", value: equilibrio, color: "brand-teal" },
    { label: "Conexão", value: domainScores["seguranca-relacional"], color: "brand-navy" },
  ];

  const overallScore = Math.round(indicators.reduce((s, i) => s + i.value, 0) / indicators.length);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="glass-card rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Prontidão de Hoje
        </p>
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${getBarColor(overallScore)}`} />
          <span className="text-sm font-bold text-foreground">{overallScore}</span>
        </div>
      </div>

      <div className="space-y-3">
        {indicators.map((ind, i) => (
          <IndicatorBar key={ind.label} indicator={ind} delay={0.1 + i * 0.08} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
        {getAdaptivePhrase(indicators)}
      </p>
    </motion.section>
  );
}
