/**
 * Score engine — client-side scoring for daily check-ins.
 *
 * Server is the canonical store since S13. This module provides:
 *   (a) `computeCheckInResult` — pure domain-score + flag computation (no side-effects)
 *   (b) `computeTagCloud` — pure tag-frequency aggregator for server history
 *   (c) `getDomainMeta` — static metadata for score domains
 *   (d) `computeIRP` — Índice de Risco Psicossocial (PRD v2.0 S7)
 */

import {
  type ScoreDomainId,
  type SkyState,
  DAILY_STEPS,
  SCORE_DOMAINS,
  CONTEXT_TAG_FLAGS,
  CONTEXT_TAG_LABELS,
  computeDomainScores,
  collectFlags,
} from "@/lib/checkin-data";
import { HLB_MAX, ICE_MAX } from "@shared/constants";
import { devNow } from "@shared/dev-clock";

// ── Types ─────────────────────────────────────────

export interface TodayScores {
  domainScores: Record<ScoreDomainId, number>;
  skyState: SkyState;
  solarHaloLevel: number;
  flags: string[];
  hasCheckedIn: boolean;
}

// ── Helpers ───────────────────────────────────────

function todayKey(): string {
  return devNow().toISOString().slice(0, 10);
}

// ── Public API ────────────────────────────────────

/** Pure computation of domain scores + flags from raw answers. No side-effects. */
export function computeCheckInResult(
  answers: Record<string, string | string[]>,
): { date: string; answers: Record<string, string | string[]>; domainScores: Record<ScoreDomainId, number>; flags: string[] } {
  return {
    date: todayKey(),
    answers,
    domainScores: computeDomainScores(answers),
    flags: collectFlags(answers, DAILY_STEPS),
  };
}

/** Get domain metadata (labels, descriptions). */
export function getDomainMeta() {
  return SCORE_DOMAINS;
}

/** Chart color per score domain — single source of truth. */
export const DOMAIN_COLORS: Record<ScoreDomainId, string> = {
  recarga: "hsl(142 71% 45%)",              // score-good
  "estado-do-dia": "hsl(44 90% 51%)",        // brand-gold
  "seguranca-relacional": "hsl(187 62% 44%)", // brand-teal
};

/** Warm display names for narrative UI elements. */
export const DOMAIN_WARM_NAMES: Record<ScoreDomainId, string> = {
  recarga: "Sua energia",
  "estado-do-dia": "Seu dia",
  "seguranca-relacional": "O clima ao redor",
};

// ── Narrative wellness tiles (IIB "Beautiful News" pattern) ────────

interface NarrativeEntry {
  readonly emoji: string;
  readonly text: string;
}

const DOMAIN_NARRATIVES: Record<ScoreDomainId, readonly [number, NarrativeEntry][]> = {
  recarga: [
    [75, { emoji: "✨", text: "Bateria cheia — dia bom pra avançar" }],
    [50, { emoji: "🔋", text: "Energia estável — mantém o ritmo" }],
    [25, { emoji: "⚡", text: "Dia mais puxado — cuide das pausas" }],
    [0, { emoji: "☁️", text: "Sua bateria precisa de atenção" }],
  ],
  "estado-do-dia": [
    [75, { emoji: "☀️", text: "Dia luminoso — aproveite" }],
    [50, { emoji: "🌤️", text: "Leveza no ar — bom sinal" }],
    [25, { emoji: "🌥️", text: "Dia sensível — sem pressa" }],
    [0, { emoji: "🌧️", text: "Momento delicado — vá no seu tempo" }],
  ],
  "seguranca-relacional": [
    [75, { emoji: "💫", text: "Ambiente acolhedor — ótimo pra trocas" }],
    [50, { emoji: "🤝", text: "Clima tranquilo — bom pra conexões" }],
    [25, { emoji: "🏠", text: "Clima morno — prefira interações leves" }],
    [0, { emoji: "🛡️", text: "O ambiente pede cautela — proteja seu espaço" }],
  ],
};

/** Emoji + narrative sentence for a domain score. No raw numbers. */
export function getDomainNarrative(domainId: ScoreDomainId, score: number): NarrativeEntry {
  const tiers = DOMAIN_NARRATIVES[domainId];
  const match = tiers.find(([threshold]) => score >= threshold);
  return match?.[1] ?? tiers.at(-1)![1];
}

// ── M3 helpers ────────────────────────────────────

export interface TagCount {
  flag: string;
  label: string;
  count: number;
}

/**
 * Pure tag-frequency aggregator. Accepts any record array with a `flags` field.
 * Used by pages that receive server history.
 */
export function computeTagCloud(
  records: ReadonlyArray<{ readonly flags: string[] }>,
): TagCount[] {
  const counts: Record<string, number> = {};
  for (const record of records) {
    for (const flag of record.flags) {
      if (CONTEXT_TAG_FLAGS.includes(flag)) {
        counts[flag] = (counts[flag] ?? 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .map(([flag, count]) => ({ flag, label: CONTEXT_TAG_LABELS[flag] ?? flag, count }))
    .toSorted((a, b) => b.count - a.count);
}

// ── Baseline (typical range) ──────────────────────

export const BASELINE_MIN_RECORDS = 21;

export interface DomainBaseline {
  readonly domain: ScoreDomainId;
  readonly low: number;
  readonly high: number;
}

/**
 * Compute "typical range" per domain from history (P25–P75).
 * Returns null if fewer than BASELINE_MIN_RECORDS records.
 */
export function computeBaseline(
  records: ReadonlyArray<{ readonly domainScores: Record<string, number> }>,
): Record<ScoreDomainId, DomainBaseline> | null {
  if (records.length < BASELINE_MIN_RECORDS) return null;

  const result = {} as Record<ScoreDomainId, DomainBaseline>;

  for (const domain of SCORE_DOMAINS) {
    const vals = records
      .map((r) => r.domainScores[domain.id])
      .filter((v): v is number => v !== undefined)
      .toSorted((a, b) => a - b);

    if (vals.length < BASELINE_MIN_RECORDS) continue;

    const p25 = vals[Math.floor(vals.length * 0.25)];
    const p75 = vals[Math.floor(vals.length * 0.75)];
    result[domain.id] = { domain: domain.id, low: Math.round(p25), high: Math.round(p75) };
  }

  return Object.keys(result).length === SCORE_DOMAINS.length ? result : null;
}

// ── IRP (Índice de Risco Psicossocial) ────────────

/**
 * Compute IRP from recent check-in history.
 *
 * Formula (PRD v2.0 S7):
 *   IRP = ((μHLB + (6 − μICE)) / 2 − 1) × 25
 *
 * Where:
 *   μHLB = mean of "hlb_proxy" tag frequency over the window (0–5)
 *   μICE = mean of Q5 ICE scores over the window (1–4 → inverted: 6−x ∈ [2,5])
 *
 * Result range: [0, 100]. Higher = worse risk.
 */
export function computeIRP(
  records: ReadonlyArray<{
    readonly flags: readonly string[];
    readonly answers: Record<string, string | string[]>;
  }>,
): number {
  if (records.length === 0) return 0;

  // μHLB: how often "hlb_proxy" (Liderança/Gestão) tag was selected
  const hlbCount = records.filter((r) => r.flags.includes("hlb_proxy")).length;
  const muHLB = Math.min((hlbCount / records.length) * HLB_MAX, HLB_MAX);

  // μICE: mean Q5 score (supported=4, normal=3, tense=2, pressured=1)
  const iceScores = records
    .map((r) => {
      const safetyAnswer = r.answers.safety;
      if (!safetyAnswer) return null;
      const answerId = Array.isArray(safetyAnswer) ? safetyAnswer[0] : safetyAnswer;
      const step = DAILY_STEPS.find((s) => s.id === "safety");
      return step?.options.find((o) => o.id === answerId)?.score ?? null;
    })
    .filter((s): s is number => s !== null);

  const muICE = iceScores.length > 0
    ? iceScores.reduce((a, b) => a + b, 0) / iceScores.length
    : ICE_MAX; // default = best case (no risk)

  const raw = ((muHLB + (6 - muICE)) / 2 - 1) * 25;
  return Math.round(Math.max(0, Math.min(100, raw)));
}
