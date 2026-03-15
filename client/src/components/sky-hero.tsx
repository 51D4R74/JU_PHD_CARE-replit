/**
 * SkyHero — fullbleed dashboard hero with progressive sky photography.
 *
 * Shows a sky photo (SOL_01–SOL_06) that reflects the user's composite
 * wellness score. Controls bar, domain pills, status headline, and Lumina
 * narrative float over the image with glassmorphic treatment.
 */

import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import AnimatedBrandLogo from "@/components/animated-brand-logo";
import ConstancyDots from "@/components/constancy-dots";
import SolarPointsBadge from "@/components/solar-points-badge";
import NotificationBadge from "@/components/notification-badge";
import { type TodayScores, getDomainNarrative, getDomainMeta, DOMAIN_WARM_NAMES } from "@/lib/score-engine";
import { getSkyHero, getDefaultSkyHero, getCompositeScore, type SkyHeroData } from "@/lib/sky-image";
import { selectLuminaMessage } from "@/lib/lumina-engine";
import type { ScoreDomainId } from "@/lib/checkin-data";
import { devNow } from "@shared/dev-clock";

// ── Types ─────────────────────────────────────────

type SkyHeroProps = Readonly<{
  firstName: string;
  scores: TodayScores;
  solarPoints: number;
  checkedInDates: ReadonlyArray<string>;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onTapLumina: () => void;
}>;

// ── Helpers ───────────────────────────────────────

function getGreeting(): string {
  const hour = devNow().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function resolveHero(scores: TodayScores): SkyHeroData {
  if (scores.hasCheckedIn) {
    return getSkyHero(getCompositeScore(scores.domainScores));
  }
  return getDefaultSkyHero();
}

function resolveLuminaContext(scores: TodayScores): "dashboard" | "dashboard-low" {
  const CRISIS_THRESHOLD = 25;
  const hasCrisis = scores.hasCheckedIn && Object.values(scores.domainScores).some(
    (s) => s < CRISIS_THRESHOLD,
  );
  return hasCrisis ? "dashboard-low" : "dashboard";
}

// ── Domain pill ───────────────────────────────────

function DomainPill({
  domainId,
  score,
  hasData,
}: Readonly<{ domainId: ScoreDomainId; score: number; hasData: boolean }>) {
  const narrative = getDomainNarrative(domainId, score);
  const warmName = DOMAIN_WARM_NAMES[domainId];
  const emoji = hasData ? narrative.emoji : "·";

  return (
    <span className="glass-sky-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white/90 text-[11px] font-semibold tracking-wide">
      <span role="img" aria-hidden="true">{emoji}</span>
      <span>{warmName}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────

export default function SkyHero({
  firstName,
  scores,
  solarPoints,
  checkedInDates,
  onOpenNotifications,
  onOpenSettings,
  onTapLumina,
}: SkyHeroProps) {
  const hero = resolveHero(scores);
  const luminaContext = resolveLuminaContext(scores);
  const luminaMessage = selectLuminaMessage(luminaContext);
  const domains = getDomainMeta();

  const headline = scores.hasCheckedIn
    ? hero.label
    : `${getGreeting()}, ${firstName}`;

  const subtitle = scores.hasCheckedIn
    ? luminaMessage.text
    : "Como você está hoje?";

  return (
    <section className="relative w-full min-h-[34svh] sm:min-h-[42vh]">
      {/* Sky photo background */}
      <motion.img
        key={hero.src}
        src={hero.src}
        alt={hero.alt}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.48) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Controls bar — absolute top */}
      <div className="relative z-10 px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-sky-controls flex items-center justify-between rounded-2xl px-3 py-2"
        >
          <AnimatedBrandLogo size="compact" showWordmark={false} />
          <div className="flex items-center gap-2">
            <SolarPointsBadge points={solarPoints} />
            <NotificationBadge onClick={onOpenNotifications} />
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10"
              aria-label="Configurações"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Hero content — bottom-anchored */}
      <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-6 pt-10 sm:pb-8" style={{ minHeight: "calc(34svh - 60px)" }}>
        {/* Domain pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {domains.map((d) => (
            <DomainPill
              key={d.id}
              domainId={d.id}
              score={Math.round(scores.domainScores[d.id] ?? 0)}
              hasData={scores.hasCheckedIn}
            />
          ))}
        </motion.div>

        {/* Status headline */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="text-sky-readable mt-4 text-center text-3xl font-semibold leading-tight tracking-tight"
        >
          {headline}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.45 }}
          className="mt-3"
        >
          <ConstancyDots checkedInDates={checkedInDates} days={7} variant="hero" />
        </motion.div>

        {/* Lumina narrative line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42, duration: 0.5 }}
          className="mt-2 max-w-xs text-center text-base leading-relaxed text-white/80"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}
        >
          {subtitle}
        </motion.p>

        {/* Lumina CTA pill */}
        {scores.hasCheckedIn && (
          <motion.button
            type="button"
            onClick={onTapLumina}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.58, duration: 0.4, type: "spring", stiffness: 300, damping: 22 }}
            className="glass-sky-cta mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            ✦ {luminaMessage.cta}
          </motion.button>
        )}
      </div>
    </section>
  );
}
