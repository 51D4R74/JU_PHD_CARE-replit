/**
 * SkyHero — fullbleed dashboard hero with progressive sky photography.
 *
 * Shows a sky photo (SOL_01–SOL_06) that reflects the user's composite
 * wellness score. Controls bar, domain pills, status headline, and Lumina
 * narrative float over the image with glassmorphic treatment.
 */

import { motion } from "framer-motion";
import { GearSix } from "@phosphor-icons/react";
import AnimatedBrandLogo from "@/components/animated-brand-logo";
import ConstancyDots from "@/components/constancy-dots";
import SolarPointsBadge from "@/components/solar-points-badge";
import NotificationBadge from "@/components/notification-badge";
import { type TodayScores, getDomainNarrative, getDomainMeta, DOMAIN_WARM_NAMES } from "@/lib/score-engine";
import { getSkyHero, getDefaultSkyHero, getCompositeScore, type SkyHeroData } from "@/lib/sky-image";
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
  onNavigateDomains: () => void;
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

function buildBottomScrim(dimOverlay: number): string {
  const peakAlpha = Math.min(0.75, dimOverlay + 0.22);
  const midAlpha = Math.min(0.55, dimOverlay + 0.08);
  return `linear-gradient(to top, rgba(0,0,0,${peakAlpha.toFixed(2)}) 0%, rgba(0,0,0,${midAlpha.toFixed(2)}) 35%, rgba(0,0,0,0.12) 60%, transparent 80%)`;
}

// ── Domain pill ───────────────────────────────────

function DomainPill({
  domainId,
  score,
  hasData,
  onClick,
}: Readonly<{ domainId: ScoreDomainId; score: number; hasData: boolean; onClick: () => void }>) {
  const narrative = getDomainNarrative(domainId, score);
  const warmName = DOMAIN_WARM_NAMES[domainId];
  const emoji = hasData ? narrative.emoji : "·";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide bg-white/95 text-brand-navy shadow-sm backdrop-blur-sm transition-transform active:scale-95"
    >
      <span role="img" aria-hidden="true">{emoji}</span>
      <span>{warmName}</span>
    </button>
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
  onNavigateDomains,
}: SkyHeroProps) {
  const hero = resolveHero(scores);
  const domains = getDomainMeta();

  const headline = scores.hasCheckedIn
    ? hero.label
    : `${getGreeting()}, ${firstName}`;

  const subtitle = scores.hasCheckedIn
    ? null
    : "Como você está hoje?";

  return (
    <section className="relative w-full min-h-[42svh] sm:min-h-[52vh]">
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

      {/* Layer 1: Bottom-up scrim — protects text content zone */}
      <div
        className="absolute inset-0"
        style={{ background: buildBottomScrim(hero.dimOverlay) }}
        aria-hidden="true"
      />

      {/* Layer 2: Top-down fade — protects controls zone */}
      <div
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Layer 3: Radial content scrim — darkens the text cluster zone */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 90% 45% at 50% 68%, rgba(0,0,0,0.18) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Warm sunrise glow bloom at bottom center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 85%, rgba(255,180,50,0.08) 0%, transparent 55%)",
        }}
        aria-hidden="true"
      />

      {/* Controls bar */}
      <div className="relative z-10 px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="sky-controls-band flex items-center justify-between px-2 py-2"
        >
          <div className="sky-logo-glass flex items-center justify-center rounded-full">
            <AnimatedBrandLogo size="compact" showWordmark={false} />
          </div>
          <div className="flex items-center gap-2">
            <SolarPointsBadge points={solarPoints} />
            <NotificationBadge onClick={onOpenNotifications} />
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10"
              aria-label="Configurações"
            >
              <GearSix className="h-4 w-4" weight="bold" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Hero content — bottom-anchored */}
      <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-6 pt-10 sm:pb-8" style={{ minHeight: "calc(40svh - 60px)" }}>
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
              onClick={onNavigateDomains}
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

        {subtitle !== null && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.5 }}
            className="text-sky-readable mt-2 max-w-xs text-center text-base leading-relaxed"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
}
