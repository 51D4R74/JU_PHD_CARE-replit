/**
 * SolarPointsBadge — animated point counter for the dashboard header.
 *
 * Shows today's Solar Points with a scale pop on increment.
 * Points are computed by the parent from server data.
 * When points are 0 and user hasn't dismissed, shows an explanatory tooltip.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sun } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TOOLTIP_DISMISSED_KEY = "lumina_solar_tooltip_dismissed";
const LEGACY_TOOLTIP_DISMISSED_KEY = "juphdcare_solar_tooltip_dismissed";

interface SolarPointsBadgeProps {
  readonly points: number;
  readonly className?: string;
}

export default function SolarPointsBadge({
  points,
  className = "",
}: Readonly<SolarPointsBadgeProps>) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (points > 0) return;
    const dismissed = localStorage.getItem(TOOLTIP_DISMISSED_KEY) ?? localStorage.getItem(LEGACY_TOOLTIP_DISMISSED_KEY);
    if (dismissed) return;
    // Show after a short delay so the page settles
    const timer = setTimeout(() => setShowHint(true), 1200);
    return () => clearTimeout(timer);
  }, [points]);

  function handleDismiss() {
    setShowHint(false);
    localStorage.setItem(TOOLTIP_DISMISSED_KEY, "1");
    localStorage.removeItem(LEGACY_TOOLTIP_DISMISSED_KEY);
  }

  const badge = (
    <motion.div
      key={points}
      initial={{ scale: 0.85, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-card px-3 py-1.5 shadow-sm ${className}`}
    >
      <Sun className="w-3.5 h-3.5 text-brand-gold-dark" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Solar
      </span>
      <span className="text-sm font-bold text-foreground tabular-nums">
        {points}
      </span>
    </motion.div>
  );

  if (points > 0) return badge;

  return (
    <TooltipProvider>
      <Tooltip open={showHint} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
        <TooltipTrigger asChild onClick={handleDismiss}>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs leading-relaxed">
          <p className="mb-0.5 font-semibold">Pontos Solares</p>
          <p>Faça seu check-in diário e complete atividades do Pra Você para acumular pontos e ver seu halo brilhar.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
