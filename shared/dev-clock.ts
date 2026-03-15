/**
 * Dev clock — deterministic time simulation for testing temporal features.
 *
 * In production, devNow() returns real system time (zero overhead).
 * In development, time starts at March 1 2026 06:00 BRT and ticks forward
 * in real-time from that point. Manual offsets (toolbar buttons) stack on top.
 *
 * Architecture: server holds ground-truth state. Client syncs via
 * GET /api/dev/clock after each toolbar action, then applies the snapshot
 * so client-side devNow() matches the server.
 */

// March 1 2026 06:00 BRT = March 1 2026 09:00 UTC
const SIM_START_EPOCH = Date.UTC(2026, 2, 1, 9, 0, 0);

let appStartEpoch = Date.now();
let manualOffsetMs = 0;

const IS_PROD = process.env.NODE_ENV === "production";

// ── Core API ──────────────────────────────────────

/** Current simulated time (or real time in production). */
export function devNow(): Date {
  if (IS_PROD) return new Date();
  const elapsed = Date.now() - appStartEpoch;
  return new Date(SIM_START_EPOCH + elapsed + manualOffsetMs);
}

/** Advance simulated clock by the given milliseconds. */
export function devAdvanceMs(ms: number): void {
  manualOffsetMs += ms;
}

/** Reset simulated clock to March 1 06:00 BRT. */
export function devResetClock(): void {
  manualOffsetMs = 0;
  appStartEpoch = Date.now();
}

// ── Snapshot sync (client ↔ server) ───────────────

export interface DevClockSnapshot {
  readonly simStart: number;
  readonly appStart: number;
  readonly offsetMs: number;
  readonly simNow: string;
}

export function getDevClockSnapshot(): DevClockSnapshot {
  return {
    simStart: SIM_START_EPOCH,
    appStart: appStartEpoch,
    offsetMs: manualOffsetMs,
    simNow: devNow().toISOString(),
  };
}

/** Apply a snapshot received from the server so client devNow() stays in sync. */
export function applyDevClockSnapshot(snapshot: { readonly appStart: number; readonly offsetMs: number }): void {
  appStartEpoch = snapshot.appStart;
  manualOffsetMs = snapshot.offsetMs;
}
