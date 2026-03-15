/**
 * Sky hero image engine — maps composite wellness score to a progressive
 * sky photograph for the dashboard fullbleed hero.
 *
 * The 6 images (SOL_01 → SOL_06) form a visual scale from stormy/dramatic
 * to clear/radiant. The composite score (simple average of 3 domain scores)
 * selects the appropriate image.
 *
 * This is a PARALLEL system alongside SkyState (4 values).
 * SkyState stays unchanged for mission-engine, support-engine, etc.
 */

import type { ScoreDomainId } from "@/lib/checkin-data";

export interface SkyHeroData {
  readonly src: string;
  readonly alt: string;
  readonly label: string;
}

interface SkyHeroTier {
  readonly min: number;
  readonly src: string;
  readonly alt: string;
  readonly label: string;
}

/** Descending order — first match wins. */
export const SKY_HERO_TIERS: readonly SkyHeroTier[] = [
  { min: 80, src: "/sky/sol-06.png", alt: "Céu azul límpido com sol radiante", label: "Dia Radiante" },
  { min: 65, src: "/sky/sol-05.png", alt: "Sol brilhante com céu azul e raios dourados", label: "Dia Luminoso" },
  { min: 50, src: "/sky/sol-04.png", alt: "Sol dourado dominante com nuvens nas bordas", label: "Dia Equilibrado" },
  { min: 34, src: "/sky/sol-03.png", alt: "Nuvens se abrindo com sol ao centro", label: "Dia de Cuidado" },
  { min: 17, src: "/sky/sol-02.png", alt: "Nuvens escuras com raios dourados surgindo", label: "Dia Sensível" },
  { min: 0,  src: "/sky/sol-01.png", alt: "Nuvens carregadas com sol tentando surgir", label: "Dia de Resguardo" },
] as const;

const DEFAULT_TIER = SKY_HERO_TIERS[2]; // SOL_04 — warm, neutral welcome

const FALLBACK_TIER: SkyHeroTier = SKY_HERO_TIERS[5]; // last tier (SOL_01)

/** Simple average of the 3 domain scores (0–100). */
export function getCompositeScore(domainScores: Record<ScoreDomainId, number>): number {
  return Math.round(
    (domainScores.recarga +
      domainScores["estado-do-dia"] +
      domainScores["seguranca-relacional"]) / 3,
  );
}

/** Returns the sky hero image data for a given composite score. */
export function getSkyHero(compositeScore: number): SkyHeroData {
  const tier = SKY_HERO_TIERS.find((t) => compositeScore >= t.min) ?? FALLBACK_TIER;
  return { src: tier.src, alt: tier.alt, label: tier.label };
}

/** Returns the default (pre-check-in) sky hero. */
export function getDefaultSkyHero(): SkyHeroData {
  return { src: DEFAULT_TIER.src, alt: DEFAULT_TIER.alt, label: DEFAULT_TIER.label };
}
