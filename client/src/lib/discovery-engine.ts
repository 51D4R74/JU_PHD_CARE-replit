/**
 * Discovery engine — correlates context tags with domain scores.
 *
 * Rules (from M3 spec):
 *   - Minimum 14 check-in records required
 *   - Minimum 5 occurrences of a tag before correlating
 *   - Minimum 3 records WITHOUT the tag (control group)
 *   - Minimum 10-point average difference to surface a discovery
 *   - Output at most 3 discoveries, sorted by magnitude
 *   - Always phrase as observation (correlation), never causation
 *
 * Discovery computation stays client-side (pure deterministic correlation — no server needed).
 * Input comes from the server history endpoint (CheckInHistoryRecord[]).
 */

import {
  CONTEXT_TAG_FLAGS,
  CONTEXT_TAG_LABELS,
  SCORE_DOMAINS,
  type ScoreDomainId,
} from "@/lib/checkin-data";

// Minimum record shape required by the discovery algorithm.
// Compatible with CheckInHistoryRecord (API).
type DiscoveryInput = {
  readonly flags: string[];
  readonly domainScores: Record<string, number>;
};

// ── Constants ─────────────────────────────────────

export const DISCOVERY_MIN_RECORDS = 14;
export const DISCOVERY_MIN_OCCURRENCES = 5;
const DISCOVERY_MIN_CONTROL = 3;
const DISCOVERY_MIN_DIFF = 10;
const DISCOVERY_MAX_RESULTS = 3;

// ── Types ─────────────────────────────────────────

export interface Discovery {
  id: string;
  tagFlag: string;
  tagLabel: string;
  domain: ScoreDomainId;
  domainLabel: string;
  direction: "up" | "down";
  withCount: number;     // n records where tag was present
  diff: number;          // absolute average difference (0–100 scale)
  text: string;          // PT-BR correlation sentence
}

// ── Helpers ───────────────────────────────────────

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildText(
  tagLabel: string,
  domainLabel: string,
  direction: "up" | "down",
): string {
  const dir =
    direction === "up"
      ? "tende a ficar melhor"
      : "tende a cair";
  return `Nos dias com "${tagLabel}", sua ${domainLabel} ${dir}.`;
}

// ── Public API ────────────────────────────────────

/**
 * Compute discoveries from a check-in record array.
 * Works with both DailyCheckInRecord (localStorage) and CheckInHistoryRecord (API).
 * Returns [] if not enough data yet.
 */
export function computeDiscoveries(
  records: ReadonlyArray<DiscoveryInput>,
): Discovery[] {
  if (records.length < DISCOVERY_MIN_RECORDS) return [];

  const result: Discovery[] = [];

  for (const tagFlag of CONTEXT_TAG_FLAGS) {
    const withTag = records.filter((r) => r.flags.includes(tagFlag));
    if (withTag.length < DISCOVERY_MIN_OCCURRENCES) continue;

    const withoutTag = records.filter((r) => !r.flags.includes(tagFlag));
    if (withoutTag.length < DISCOVERY_MIN_CONTROL) continue;

    for (const domain of SCORE_DOMAINS) {
      const avgWith = mean(withTag.map((r) => r.domainScores[domain.id]));
      const avgWithout = mean(withoutTag.map((r) => r.domainScores[domain.id]));
      const diff = avgWith - avgWithout;

      if (Math.abs(diff) < DISCOVERY_MIN_DIFF) continue;

      const direction: "up" | "down" = diff > 0 ? "up" : "down";
      const tagLabel = CONTEXT_TAG_LABELS[tagFlag] ?? tagFlag;

      result.push({
        id: `${tagFlag}-${domain.id}`,
        tagFlag,
        tagLabel,
        domain: domain.id,
        domainLabel: domain.label,
        direction,
        withCount: withTag.length,
        diff: Math.round(Math.abs(diff)),
        text: buildText(tagLabel, domain.label, direction),
      });
    }
  }

  // Return top N by magnitude (largest diff first)
  return [...result]
    .toSorted((a, b) => b.diff - a.diff)
    .slice(0, DISCOVERY_MAX_RESULTS);
}

/**
 * Progress indicator for users not yet at the discovery threshold.
 * Returns days remaining until first possible discovery.
 */
export function daysUntilDiscovery(totalRecords: number): number {
  return Math.max(0, DISCOVERY_MIN_RECORDS - totalRecords);
}
