/**
 * DevToolbar — floating time-simulation toolbar for dev/testing.
 *
 * Shows simulated date/time and buttons to advance the clock.
 * Only renders in development mode (tree-shaken in production builds).
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { applyDevClockSnapshot, devNow, type DevClockSnapshot } from "@shared/dev-clock";

const HOUR = 3_600_000;

type ClockAction = "advance1h" | "advance6h" | "advance1d";

function formatSimTime(d: Date): string {
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

export default function DevToolbar() {
  const qc = useQueryClient();
  const [display, setDisplay] = useState(() => formatSimTime(devNow()));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Sync from server on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dev/clock");
        if (!res.ok) return;
        const snap: DevClockSnapshot = await res.json();
        applyDevClockSnapshot({ appStart: snap.appStart, offsetMs: snap.offsetMs });
        setDisplay(formatSimTime(devNow()));
      } catch { /* server might not be ready yet */ }
    })();
  }, []);

  // Tick display every 15s
  useEffect(() => {
    const id = setInterval(() => setDisplay(formatSimTime(devNow())), 15_000);
    return () => clearInterval(id);
  }, []);

  const advance = useCallback(async (action: ClockAction) => {
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/dev/clock", { action });
      const snap: DevClockSnapshot = await res.json();
      applyDevClockSnapshot({ appStart: snap.appStart, offsetMs: snap.offsetMs });
      setDisplay(formatSimTime(devNow()));
      await qc.invalidateQueries();
    } finally {
      setBusy(false);
    }
  }, [qc]);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/dev/reset");
      const snap: DevClockSnapshot = await res.json();
      applyDevClockSnapshot({ appStart: snap.appStart, offsetMs: snap.offsetMs });
      setDisplay(formatSimTime(devNow()));
      await qc.invalidateQueries();
    } finally {
      setBusy(false);
    }
  }, [qc]);

  const btnClass =
    "px-2 py-1 rounded text-[11px] font-medium transition-colors " +
    "bg-zinc-700 hover:bg-zinc-600 text-zinc-100 disabled:opacity-40";

  if (dismissed) return null;

  return (
    <div className="fixed bottom-2 left-2 z-[9999] flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-1.5 shadow-lg backdrop-blur text-[12px] text-zinc-300 font-mono">
      <span className="mr-1 select-none" title="Relógio simulado">⏱</span>
      <span className="min-w-[110px]">{display}</span>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void advance("advance1h")}>+1h</button>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void advance("advance6h")}>+6h</button>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void advance("advance1d")}>+1d</button>
      <button type="button" className={`${btnClass} bg-red-800 hover:bg-red-700`} disabled={busy} onClick={() => void reset()}>Reset</button>
      <button
        type="button"
        title="Fechar barra de tempo"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
