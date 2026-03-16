/**
 * DevToolbar — floating time-simulation toolbar for dev/testing.
 *
 * Shows simulated date/time and buttons to advance the clock.
 * Only renders in development mode (tree-shaken in production builds).
 * The toolbar is draggable — grab anywhere except the buttons.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { applyDevClockSnapshot, devNow, type DevClockSnapshot } from "@shared/dev-clock";

const HOUR = 3_600_000;

type ClockAction = "advance1h" | "advance6h" | "advance1d";

function formatSimTime(d: Date): string {
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day}\n${time}`;
}

export default function DevToolbar() {
  const qc = useQueryClient();
  const [display, setDisplay] = useState(() => formatSimTime(devNow()));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Drag state
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOrigin = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // After first render, capture the element's natural position (bottom-left)
  // and switch to explicit top/left so drag works correctly.
  useEffect(() => {
    if (!pos && barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      setPos({ x: rect.left, y: rect.top });
    }
  }, [pos]);

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

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOrigin.current = {
      mx: e.clientX,
      my: e.clientY,
      px: pos?.x ?? 8,
      py: pos?.y ?? (window.innerHeight - 56),
    };
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return;
    const x = dragOrigin.current.px + (e.clientX - dragOrigin.current.mx);
    const y = dragOrigin.current.py + (e.clientY - dragOrigin.current.my);
    setPos({ x, y });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragOrigin.current = null;
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const btnClass =
    "px-2 py-1 rounded text-[11px] font-medium transition-colors " +
    "bg-zinc-700 hover:bg-zinc-600 text-zinc-100 disabled:opacity-40";

  if (dismissed) return null;

  const isDragging = dragOrigin.current !== null;

  return (
    <div
      ref={barRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed ${!pos ? "bottom-2 left-2" : ""} z-[9999] flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-1.5 shadow-lg backdrop-blur text-[12px] text-zinc-300 font-mono select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="mr-1 leading-none" title="Arraste para mover">⏱</span>
      <span className="min-w-[72px] leading-tight whitespace-pre text-[11px]">{display}</span>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void advance("advance1h")}>+1h</button>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void advance("advance6h")}>+6h</button>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void advance("advance1d")}>+1d</button>
      <button type="button" className={`${btnClass} bg-red-800 hover:bg-red-700`} disabled={busy} onClick={() => void reset()}>Reset</button>
      <button
        type="button"
        title="Fechar barra de tempo"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
