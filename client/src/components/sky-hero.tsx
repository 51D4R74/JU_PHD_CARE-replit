/**
 * SkyHero — fullbleed dashboard hero with progressive sky photography.
 *
 * Shows a sky photo (SOL_01–SOL_06) that reflects the user's composite
 * wellness score. Controls bar with inline domain indicators, status
 * headline, and constancy dots float over the image.
 */

import { motion } from "framer-motion";
import { GearSix, Lightning, Sun, Cloud, type Icon } from "@phosphor-icons/react";
import ConstancyDots from "@/components/constancy-dots";
import NotificationBadge from "@/components/notification-badge";
import { type TodayScores, getDomainMeta } from "@/lib/score-engine";
import { getSkyHero, getDefaultSkyHero, getCompositeScore, type SkyHeroData } from "@/lib/sky-image";
import type { ScoreDomainId } from "@/lib/checkin-data";
import { devNow } from "@shared/dev-clock";

type SkyHeroProps = Readonly<{
  firstName: string;
  scores: TodayScores;
  checkedInDates: ReadonlyArray<string>;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onNavigateDomains: () => void;
}>;

const DOMAIN_SHORT_LABELS: Record<ScoreDomainId, string> = {
  recarga: "Energia",
  "estado-do-dia": "Dia",
  "seguranca-relacional": "Clima",
};

const DOMAIN_ICONS: Record<ScoreDomainId, Icon> = {
  recarga: Lightning,
  "estado-do-dia": Sun,
  "seguranca-relacional": Cloud,
};

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

function DomainPill({
  domainId,
  onClick,
}: Readonly<{ domainId: ScoreDomainId; onClick: () => void }>) {
  const Icon = DOMAIN_ICONS[domainId];
  const label = DOMAIN_SHORT_LABELS[domainId];

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide bg-white/20 text-white/90 backdrop-blur-sm transition-transform active:scale-95"
    >
      <Icon className="h-3 w-3" weight="fill" />
      <span>{label}</span>
    </button>
  );
}

export default function SkyHero({
  firstName,
  scores,
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

  return (
    <section className="relative w-full min-h-[42svh] sm:min-h-[52vh]">
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

      <div
        className="absolute inset-0"
        style={{ background: buildBottomScrim(hero.dimOverlay) }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 90% 45% at 50% 68%, rgba(0,0,0,0.18) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 85%, rgba(255,180,50,0.08) 0%, transparent 55%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="sky-controls-band relative flex items-center justify-end px-2 py-2"
        >
          {/* Pills — true geometric center of the bar */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex items-center gap-3">
              {domains.map((d) => (
                <DomainPill
                  key={d.id}
                  domainId={d.id}
                  onClick={onNavigateDomains}
                />
              ))}
            </div>
          </div>

          {/* Right side — Bell + Gear */}
          <div className="relative z-10 flex items-center gap-2">
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

      <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-6 pt-6 sm:pb-8" style={{ minHeight: "calc(40svh - 60px)" }}>
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
          className="mt-5"
        >
          <ConstancyDots checkedInDates={checkedInDates} days={7} variant="hero" />
        </motion.div>
      </div>
    </section>
  );
}
