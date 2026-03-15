/**
 * InsightCard — displays a single auto-generated correlation discovery.
 *
 * Design rules:
 * - Always phrased as correlation (observation), never causation.
 * - Shows tag label, domain, direction indicator, and sample count.
 * - Disclaimer is always visible (M3 spec: never mislead).
 */

import { TrendUp, TrendDown } from "@phosphor-icons/react";
import type { Discovery } from "@/lib/discovery-engine";

interface InsightCardProps {
  readonly discovery: Discovery;
  readonly className?: string;
}

const domainColors: Record<string, { text: string; bg: string; border: string; accent: string }> = {
  recarga: {
    text: "text-score-good",
    bg: "bg-score-good/10",
    border: "border-score-good/20",
    accent: "hsl(142 71% 45%)",
  },
  "estado-do-dia": {
    text: "text-brand-gold-dark",
    bg: "bg-brand-gold/10",
    border: "border-brand-gold/20",
    accent: "hsl(44 90% 51%)",
  },
  "seguranca-relacional": {
    text: "text-brand-teal",
    bg: "bg-brand-teal/10",
    border: "border-brand-teal/20",
    accent: "hsl(187 62% 44%)",
  },
};

export default function InsightCard({ discovery, className = "" }: InsightCardProps) {
  const colors = domainColors[discovery.domain] ?? {
    text: "text-foreground",
    bg: "bg-muted/30",
    border: "border-border/40",
    accent: "hsl(var(--primary))",
  };

  return (
    <div className={`glass-card rounded-2xl p-4 pl-5 border ${colors.border} ${className} relative overflow-hidden`}>
      {/* Domain gradient accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: `linear-gradient(to bottom, ${colors.accent}, transparent)` }}
        aria-hidden="true"
      />
      <div className="flex items-start gap-3">
        {/* Direction indicator */}
        <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          {discovery.direction === "up" ? (
            <TrendUp className={`w-4 h-4 ${colors.text}`} weight="bold" aria-label="Tendência de alta" />
          ) : (
            <TrendDown className={`w-4 h-4 ${colors.text}`} weight="bold" aria-label="Tendência de baixa" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Domain badge */}
          <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide ${colors.text} mb-1`}>
            {discovery.domainLabel}
          </span>

          {/* Correlation text */}
          <p className="text-sm leading-snug mb-1.5">{discovery.text}</p>

          {/* Sample size */}
          <p className="text-[11px] text-muted-foreground">
            Baseado em {discovery.withCount} dia{discovery.withCount === 1 ? "" : "s"} com "{discovery.tagLabel}".
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 mt-2 pt-2 border-t border-border/20">
        Uma observação do seu histórico pessoal — não é diagnóstico.
      </p>
    </div>
  );
}
