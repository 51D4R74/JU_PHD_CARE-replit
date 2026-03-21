/**
 * SkyHero — fullbleed dashboard hero with progressive sky photography.
 *
 * Shows a sky photo (SOL_01–SOL_06) reflecting the user's composite score.
 * Top bar: Lumina logo (left) + compact solar badge · Bell/Gear (right).
 * Bottom third: greeting headline + constancy dots.
 * Bottom bar: domain indicator pills overlapping the lower edge of the photo.
 */

import { motion } from "framer-motion";
import { GearSix, Lightning, Sun, Cloud } from "@phosphor-icons/react";
import ConstancyDots from "@/components/constancy-dots";
import SolarPointsBadge from "@/components/solar-points-badge";
import NotificationBadge from "@/components/notification-badge";
import { type TodayScores } from "@/lib/score-engine";
import { getSkyHero, getDefaultSkyHero, getCompositeScore, type SkyHeroData } from "@/lib/sky-image";
import type { CheckInHistoryRecord } from "@shared/schema";
import { devNow } from "@shared/dev-clock";

type SkyHeroProps = Readonly<{
  firstName: string;
  scores: TodayScores;
  solarPoints: number;
  checkedInHistory: ReadonlyArray<CheckInHistoryRecord>;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onNavigateDomains: () => void;
}>;

const DOMAIN_PILLS = [
  { id: "recarga",               label: "Energia", Icon: Lightning, color: "text-orange-300" },
  { id: "estado-do-dia",         label: "Dia",     Icon: Sun,       color: "text-yellow-300" },
  { id: "seguranca-relacional",  label: "Clima",   Icon: Cloud,     color: "text-sky-300"    },
] as const;

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
  const midAlpha  = Math.min(0.55, dimOverlay + 0.08);
  return `linear-gradient(to top, rgba(0,0,0,${peakAlpha.toFixed(2)}) 0%, rgba(0,0,0,${midAlpha.toFixed(2)}) 35%, rgba(0,0,0,0.12) 60%, transparent 80%)`;
}

export default function SkyHero({
  firstName,
  scores,
  solarPoints,
  checkedInHistory,
  onOpenNotifications,
  onOpenSettings,
  onNavigateDomains,
}: SkyHeroProps) {
  const hero     = resolveHero(scores);
  const headline = scores.hasCheckedIn
    ? hero.label
    : `${getGreeting()}, ${firstName}`;

  return (
    <section className="relative w-full min-h-[44svh] sm:min-h-[54vh]">
      {/* Background photo */}
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

      {/* Scrims */}
      <div className="absolute inset-0" style={{ background: buildBottomScrim(hero.dimOverlay) }} aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)" }} aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 90% 45% at 50% 68%, rgba(0,0,0,0.18) 0%, transparent 100%)" }} aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 85%, rgba(255,180,50,0.08) 0%, transparent 55%)" }} aria-hidden="true" />

      {/* Top controls bar */}
      <div className="relative z-10 px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="sky-controls-band flex items-center justify-between px-2 py-2"
        >
          <SolarPointsBadge points={solarPoints} compact />
          <div className="flex items-center gap-2">
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

      {/* Hero content — headline + constancy dots, anchored to lower third */}
      <div
        className="relative z-10 flex flex-col items-center justify-end px-4 pb-14 sm:pb-18"
        style={{ minHeight: "calc(40svh - 60px)" }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="text-sky-readable text-center text-3xl font-semibold leading-tight tracking-tight"
        >
          {headline}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.45 }}
          className="mt-4"
        >
          <ConstancyDots checkedInHistory={checkedInHistory} days={7} variant="hero" />
        </motion.div>
      </div>

      {/* Domain pills — anchored to bottom of photo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.45 }}
        className="absolute inset-x-0 bottom-0 z-10 flex gap-2 px-3 pb-3"
      >
        {DOMAIN_PILLS.map(({ id, label, Icon, color }) => (
          <button
            key={id}
            type="button"
            onClick={onNavigateDomains}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/20 px-3 py-2 backdrop-blur-md transition-colors hover:bg-white/30"
          >
            <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} weight="fill" />
            <span className="text-[10px] font-semibold tracking-wide text-white/90">
              {label}
            </span>
          </button>
        ))}
      </motion.div>
    </section>
  );
}
