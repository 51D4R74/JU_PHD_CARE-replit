/**
 * Shared team challenge configuration — single source of truth for
 * challenge templates, monthly selection, and date utilities.
 * Imported by both client (team-challenge-engine) and server (routes).
 */
import { devNow } from "./dev-clock";

// ── Types ─────────────────────────────────────────

export type ChallengeCategory =
  | "hydration"
  | "pause"
  | "support"
  | "checkin"
  | "breathing";

export interface ChallengeTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string; // lucide icon name
  readonly category: ChallengeCategory;
  readonly target: number;
  readonly unit: string;
  readonly capPerPersonPerDay: number;
}

// ── Challenge pool ────────────────────────────────

export const CHALLENGE_POOL: readonly ChallengeTemplate[] = [
  {
    id: "collective-water",
    title: "Copos d'água coletivos",
    description: "Juntos, vamos beber 200 copos de água este mês!",
    icon: "Droplets",
    category: "hydration",
    target: 200,
    unit: "copos",
    capPerPersonPerDay: 3,
  },
  {
    id: "collective-pause",
    title: "Pausas conscientes",
    description: "120 pausas conscientes em equipe para renovar a energia.",
    icon: "PauseCircle",
    category: "pause",
    target: 120,
    unit: "pausas",
    capPerPersonPerDay: 2,
  },
  {
    id: "collective-support",
    title: "Mensagens de apoio",
    description: "80 mensagens de apoio entre colegas. Palavras que curam.",
    icon: "Heart",
    category: "support",
    target: 80,
    unit: "mensagens",
    capPerPersonPerDay: 1,
  },
  {
    id: "collective-checkin",
    title: "Check-ins fechados",
    description: "150 check-ins completos mostram compromisso com o bem-estar.",
    icon: "ClipboardCheck",
    category: "checkin",
    target: 150,
    unit: "check-ins",
    capPerPersonPerDay: 1,
  },
  {
    id: "collective-breathing",
    title: "Minutos de respiração",
    description: "60 minutos coletivos de respiração consciente.",
    icon: "Wind",
    category: "breathing",
    target: 60,
    unit: "minutos",
    capPerPersonPerDay: 3,
  },
] as const;

// ── Monthly selection (deterministic seed) ────────

function getMonthSeed(): number {
  const now = devNow();
  return now.getFullYear() * 100 + now.getMonth();
}

export function selectMonthlyChallenge(): ChallengeTemplate {
  const seed = getMonthSeed();
  return CHALLENGE_POOL[seed % CHALLENGE_POOL.length];
}

export function getMonthBounds(): { start: string; end: string } {
  const now = devNow();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
