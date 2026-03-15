/**
 * Team challenge engine — API-backed collective mission tracker.
 *
 * All challenge state is server-authoritative.
 * Use fetchCurrentChallenge() with React Query for reads.
 * Use contributeToChallenge() with useMutation for writes.
 */

import { apiRequest } from "@/lib/queryClient";
import { type ChallengeTemplate, selectMonthlyChallenge, getMonthBounds } from "@shared/challenges";
import { devNow } from "@shared/dev-clock";

// ── Re-exports from shared (UI layers import from here) ───────────────

export type { ChallengeTemplate, ChallengeCategory } from "@shared/challenges";
export { CHALLENGE_POOL, selectMonthlyChallenge, getMonthBounds } from "@shared/challenges";

// ── Types ─────────────────────────────────────────

export interface MilestoneThreshold {
  readonly pct: number;
  readonly label: string;
  readonly reached: boolean;
}

export interface TeamChallengeSnapshot {
  readonly challengeId: string;
  readonly template: ChallengeTemplate;
  readonly startDate: string;
  readonly endDate: string;
  readonly progress: number;
  readonly progressPct: number;
  readonly daysRemaining: number;
  readonly todayCount: number;
  readonly milestones: MilestoneThreshold[];
}

export interface ContributeResult {
  readonly accepted: boolean;
  readonly newTotal: number;
  readonly reason?: string;
}

// ── API functions ─────────────────────────────────

/** Fetch current team challenge state including user's today count. */
export async function fetchCurrentChallenge(): Promise<TeamChallengeSnapshot> {
  const res = await apiRequest("GET", "/api/team-challenges/current");
  const data = await res.json() as Omit<TeamChallengeSnapshot, "milestones">;

  const milestones: MilestoneThreshold[] = [
    { pct: 25, label: "25%", reached: data.progressPct >= 25 },
    { pct: 50, label: "Metade!", reached: data.progressPct >= 50 },
    { pct: 75, label: "75%", reached: data.progressPct >= 75 },
    { pct: 100, label: "Meta atingida!", reached: data.progressPct >= 100 },
  ];

  return { ...data, milestones };
}

/** Record a single contribution for the current challenge. */
export async function contributeToChallenge(challengeId: string): Promise<ContributeResult> {
  const res = await apiRequest("POST", `/api/team-challenges/${challengeId}/contribute`);
  return res.json() as Promise<ContributeResult>;
}

// ── Pure UI helpers (no I/O) ──────────────────────

/** Compute collective sky brightness level (0–1) from team progress. */
export function getCollectiveSkyLevel(progressPct: number): number {
  return 0.2 + (progressPct / 100) * 0.8;
}

/** Human-readable summary for the team challenge CTA on dashboard. */
export function describeChallenge(progressPct: number, daysRemaining: number): string {
  if (progressPct >= 100) return "Meta atingida! Parabéns, equipe!";
  if (progressPct === 0) return daysRemaining + " dias para completar juntos";
  if (progressPct < 25) return "Recém começado — " + daysRemaining + " dias restantes";
  if (progressPct < 50) return "Bom ritmo — " + daysRemaining + " dias restantes";
  if (progressPct < 75) return "Mais da metade! " + daysRemaining + " dias restantes";
  return "Quase lá — " + daysRemaining + " dias para fechar!";
}

// ── Offline fallback (used only when API unavailable) ─────────────────

/** Build a local-only snapshot from the shared template config (no server data). */
export function buildOfflineSnapshot(): TeamChallengeSnapshot {
  const template = selectMonthlyChallenge();
  const bounds = getMonthBounds();
  const now = devNow();
  const endDate = new Date(bounds.end + "T23:59:59");
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));

  return {
    challengeId: template.id,
    template,
    startDate: bounds.start,
    endDate: bounds.end,
    progress: 0,
    progressPct: 0,
    daysRemaining,
    todayCount: 0,
    milestones: [
      { pct: 25, label: "25%", reached: false },
      { pct: 50, label: "Metade!", reached: false },
      { pct: 75, label: "75%", reached: false },
      { pct: 100, label: "Meta atingida!", reached: false },
    ],
  };
}
