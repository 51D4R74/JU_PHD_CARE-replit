import { motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoreDomainId } from "@/lib/checkin-data";

export interface ScoreContributor {
  label: string;
  value: number;
  maxValue: number;
}

type ScoreCardProps = Readonly<{
  domainId: ScoreDomainId;
  title: string;
  description: string;
  score: number;
  contributors: ScoreContributor[];
  className?: string;
  /** When false, renders a neutral muted card instead of a colored score. */
  hasData?: boolean;
}>;

const SCORE_TIERS = [
  { min: 75, color: "bg-score-good", textColor: "text-score-good", label: "Bom" },
  { min: 50, color: "bg-score-moderate", textColor: "text-score-moderate", label: "Moderado" },
  { min: 25, color: "bg-score-attention", textColor: "text-score-attention", label: "Atenção" },
  { min: 0, color: "bg-score-critical", textColor: "text-score-critical", label: "Precisa de cuidado" },
] as const;

const FALLBACK_TIER = { min: 0, color: "bg-score-critical", textColor: "text-score-critical", label: "Precisa de cuidado" } as const;

function getTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) ?? FALLBACK_TIER;
}

export default function ScoreCard({
  title,
  description,
  score,
  contributors,
  className = "",
  hasData = true,
}: ScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tier = getTier(score);

  if (!hasData) {
    return (
      <Card className={`overflow-hidden opacity-60 ${className}`.trim()}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-2xl font-bold tabular-nums text-muted-foreground/50">
                —
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
                Aguardando check-in
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" />
          <p className="mt-3 text-xs text-muted-foreground">
            Faça seu check-in pra ver
          </p>
        </CardContent>
      </Card>
    );
  }

  const borderClass = score >= 75 ? "card-score-good" : score >= 50 ? "card-score-moderate" : score >= 25 ? "card-score-attention" : "card-score-critical";

  return (
    <Card className={`overflow-hidden ${borderClass} ${className}`.trim()}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className={`text-2xl font-bold tabular-nums ${tier.textColor}`}>
              {score}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wide ${tier.textColor}`}>
              {tier.label}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Progress bar */}
        <div className="progress-track">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(score, 100)}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={`h-full rounded-full ${tier.color}`}
          />
        </div>

        {/* Expandable contributors */}
        {contributors.length > 0 ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Ver mais</span>
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <CaretDown className="h-3.5 w-3.5" weight="bold" />
              </motion.span>
            </button>

            <motion.div
              initial={false}
              animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <ul className="mt-2 space-y-1.5">
                {contributors.map((c) => {
                  const pct = c.maxValue > 0 ? Math.round((c.value / c.maxValue) * 100) : 0;
                  const cTier = getTier(pct);
                  return (
                    <li key={c.label} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 text-muted-foreground">{c.label}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${cTier.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`w-6 text-right tabular-nums font-medium ${cTier.textColor}`}>
                        {pct}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
