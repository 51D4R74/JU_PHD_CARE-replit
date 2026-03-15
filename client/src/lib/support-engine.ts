/**
 * Support engine — selects curated messages based on user state.
 *
 * Selection criteria (NASA-grade weighted decision tree):
 *   1. Category filter (user choice)
 *   2. Tag affinity: messages whose tags match current flags score higher
 *   3. Recency avoidance: messages seen recently are deprioritized
 *   4. State-aware ordering: respiro/protective skew toward calma and acolhimento
 *
 * Support messages are static curated content — intentionally client-side.
 * Favorites persist in localStorage.
 * BACKLOG: server-side favorites when user-profile API exists [future milestone]
 */

import type { SkyState } from "@/lib/checkin-data";
import { devNow } from "@shared/dev-clock";
import type { TodayScores } from "@/lib/score-engine";
import {
  SUPPORT_MESSAGES,
  type SupportCategory,
  type SupportMessage,
} from "@/lib/support-messages";
import { enterRespiroFreeze, exitRespiroFreeze } from "@/lib/solar-points";
import {
  RESPIRO_AUTO_ENTRY_DAYS,
  RESPIRO_AUTO_EXIT_DAYS,
  ESCALATION_LEVELS,
} from "@shared/constants";

// ── Modo Respiro state ────────────────────────────

const RESPIRO_KEY = "lumina_respiro";
const LEGACY_RESPIRO_KEY = "juphdcare_respiro";

export type CareLevel = 1 | 2 | 3;

export interface RespiroState {
  active: boolean;
  activatedAt: string | null; // ISO timestamp
  needSupportCount: number;   // "Preciso de apoio" taps in last 24h
  lastNeedSupportAt: string | null;
  /** Consecutive days in "respiro" sky state for auto-entry tracking. */
  consecutiveRestDays: number;
  /** Consecutive days in "partly-cloudy"+ for auto-exit tracking. */
  consecutiveRecoveryDays: number;
  /** Current escalation level: 1 = IA, 2 = CVV/CAPS, 3 = org. */
  escalationLevel: CareLevel;
}

function defaultRespiroState(): RespiroState {
  return {
    active: false,
    activatedAt: null,
    needSupportCount: 0,
    lastNeedSupportAt: null,
    consecutiveRestDays: 0,
    consecutiveRecoveryDays: 0,
    escalationLevel: 1,
  };
}

function readRespiroState(): RespiroState {
  try {
    const raw = localStorage.getItem(RESPIRO_KEY) ?? localStorage.getItem(LEGACY_RESPIRO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RespiroState>;
      return { ...defaultRespiroState(), ...parsed };
    }
  } catch (e: unknown) { console.warn("Corrupted respiro state:", e); }
  return defaultRespiroState();
}

function writeRespiroState(state: RespiroState): void {
  localStorage.setItem(RESPIRO_KEY, JSON.stringify(state));
  localStorage.removeItem(LEGACY_RESPIRO_KEY);
}

/** Check if Modo Respiro should be active. Auto-entry + auto-exit logic. */
export function evaluateRespiro(scores: TodayScores): boolean {
  const state = readRespiroState();

  // Track consecutive rest days for auto-entry
  if (scores.skyState === "respiro") {
    state.consecutiveRestDays += 1;
    state.consecutiveRecoveryDays = 0;
  } else if (scores.skyState === "partly-cloudy" || scores.skyState === "clear") {
    state.consecutiveRecoveryDays += 1;
    state.consecutiveRestDays = 0;
  } else {
    // protective-cloud: neither entry nor exit trigger
    state.consecutiveRestDays = 0;
    state.consecutiveRecoveryDays = 0;
  }

  // Auto-entry: 2 consecutive days of sky rest
  if (!state.active && state.consecutiveRestDays >= RESPIRO_AUTO_ENTRY_DAYS) {
    state.active = true;
    state.activatedAt = devNow().toISOString();
    state.escalationLevel = 1;
    enterRespiroFreeze();
    writeRespiroState(state);
    return true;
  }

  // Auto-entry: "Preciso de apoio" tapped ≥ 2 times in 24h
  if (!state.active && state.needSupportCount >= 2) {
    const lastTap = state.lastNeedSupportAt
      ? new Date(state.lastNeedSupportAt).getTime()
      : 0;
    const within24h = devNow().getTime() - lastTap < 24 * 60 * 60 * 1000;
    if (within24h) {
      state.active = true;
      state.activatedAt = devNow().toISOString();
      state.escalationLevel = 1;
      enterRespiroFreeze();
      writeRespiroState(state);
      return true;
    }
  }

  // Auto-exit: 2 consecutive days of partly-cloudy or better
  if (state.active && state.consecutiveRecoveryDays >= RESPIRO_AUTO_EXIT_DAYS) {
    state.active = false;
    state.activatedAt = null;
    state.needSupportCount = 0;
    state.consecutiveRestDays = 0;
    state.consecutiveRecoveryDays = 0;
    state.escalationLevel = 1;
    exitRespiroFreeze();
    writeRespiroState(state);
    return false;
  }

  writeRespiroState(state);
  return state.active;
}

/** Record a "Preciso de apoio" tap for Modo Respiro entry tracking. */
export function recordNeedSupport(): void {
  const state = readRespiroState();
  const now = devNow().getTime();

  // Reset counter if last tap was > 24h ago
  if (state.lastNeedSupportAt) {
    const lastTime = new Date(state.lastNeedSupportAt).getTime();
    if (now - lastTime > 24 * 60 * 60 * 1000) {
      state.needSupportCount = 0;
    }
  }

  state.needSupportCount += 1;
  state.lastNeedSupportAt = devNow().toISOString();
  writeRespiroState(state);
}

/** Manually deactivate Modo Respiro (user-initiated exit). */
export function deactivateRespiro(): void {
  const state = readRespiroState();
  state.active = false;
  state.activatedAt = null;
  state.needSupportCount = 0;
  state.consecutiveRestDays = 0;
  state.consecutiveRecoveryDays = 0;
  state.escalationLevel = 1;
  exitRespiroFreeze();
  writeRespiroState(state);
}

/** Read current Modo Respiro state. */
export function getRespiroState(): RespiroState {
  return readRespiroState();
}

// ── Stepped care escalation (PRD v2.0 S8) ────────

export type EscalationLevel = typeof ESCALATION_LEVELS[keyof typeof ESCALATION_LEVELS];

export interface EscalationAction {
  level: CareLevel;
  type: EscalationLevel;
  message: string;
  cta: string;
}

/** Get the current escalation action based on Respiro state. */
export function getEscalationAction(): EscalationAction {
  const state = readRespiroState();
  const level = state.escalationLevel;

  if (level >= 3) {
    return {
      level: 3,
      type: ESCALATION_LEVELS.level3,
      message: "Percebemos que você pode precisar de apoio especializado. Com sua permissão, podemos acionar o suporte da organização.",
      cta: "Autorizar contato",
    };
  }
  if (level >= 2) {
    return {
      level: 2,
      type: ESCALATION_LEVELS.level2,
      message: "Se precisar conversar com alguém agora, ligue para o CVV: 188 (24h). Ou procure o CAPS mais próximo.",
      cta: "Ver recursos de apoio",
    };
  }
  return {
    level: 1,
    type: ESCALATION_LEVELS.level1,
    message: "Estou aqui para ouvir. Quer conversar sobre como está se sentindo?",
    cta: "Conversar com IA",
  };
}

/** Escalate to the next care level. Returns the new level. */
export function escalateCareLevel(): EscalationAction {
  const state = readRespiroState();
  if (state.escalationLevel < 3) {
    state.escalationLevel = (state.escalationLevel + 1) as CareLevel;
    writeRespiroState(state);
  }
  return getEscalationAction();
}

// ── Favorites ─────────────────────────────────────

const FAVORITES_KEY = "lumina_support_favorites";
const LEGACY_FAVORITES_KEY = "juphdcare_support_favorites";

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY) ?? localStorage.getItem(LEGACY_FAVORITES_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch (e: unknown) { console.warn("Failed to read favorites:", e); }
  return new Set();
}

function writeFavorites(favs: Set<string>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favs)));
  localStorage.removeItem(LEGACY_FAVORITES_KEY);
}

export function toggleFavorite(messageId: string): boolean {
  const favs = readFavorites();
  if (favs.has(messageId)) {
    favs.delete(messageId);
    writeFavorites(favs);
    return false;
  }
  favs.add(messageId);
  writeFavorites(favs);
  return true;
}

export function isFavorite(messageId: string): boolean {
  return readFavorites().has(messageId);
}

export function getFavoriteMessages(): SupportMessage[] {
  const favIds = readFavorites();
  return SUPPORT_MESSAGES.filter((m) => favIds.has(m.id));
}

// ── Message seen history ──────────────────────────

const SEEN_KEY = "lumina_support_seen";
const LEGACY_SEEN_KEY = "juphdcare_support_seen";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY) ?? localStorage.getItem(LEGACY_SEEN_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch (e: unknown) { console.warn("Failed to read seen messages:", e); }
  return [];
}

function recordSeen(messageId: string): void {
  const seen = readSeen();
  // Keep last 20 to avoid localStorage bloat
  const updated = [messageId, ...seen.filter((id) => id !== messageId)].slice(0, 20);
  localStorage.setItem(SEEN_KEY, JSON.stringify(updated));
  localStorage.removeItem(LEGACY_SEEN_KEY);
}

// ── Selection engine ──────────────────────────────

interface SelectionContext {
  category: SupportCategory;
  skyState: SkyState;
  flags: string[];
}

/** Select the best message for the given context. Returns a single message. */
export function selectSupportMessage(ctx: SelectionContext): SupportMessage {
  const pool = SUPPORT_MESSAGES.filter((m) => m.category === ctx.category);
  const seen = new Set(readSeen());

  // Score each message
  const scored = pool.map((m) => {
    let score = 1;

    // Tag affinity: +2 per matching flag
    for (const tag of m.tags) {
      if (ctx.flags.includes(tag)) score += 2;
    }

    // Recency penalty
    if (seen.has(m.id)) score *= 0.3;

    // State-aware boost for calma/acolhimento under stress
    if (
      (ctx.skyState === "respiro" || ctx.skyState === "protective-cloud") &&
      (m.category === "calma" || m.category === "acolhimento")
    ) {
      score += 1;
    }

    return { message: m, score };
  });

  // Sort by score descending, pick top
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0]?.message ?? pool[0];

  recordSeen(chosen.id);
  return chosen;
}

/** Get all messages for a category (for browsing). */
export function getMessagesByCategory(category: SupportCategory): SupportMessage[] {
  return SUPPORT_MESSAGES.filter((m) => m.category === category);
}
