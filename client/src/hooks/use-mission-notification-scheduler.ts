import { useEffect, useRef } from "react";
import { devNow } from "@shared/dev-clock";
import { pushNotification } from "@/lib/notification-engine";
import { loadSettings } from "@/pages/settings";
import type { MissionCategory } from "@/lib/mission-engine";

interface SelectedMissionForNotif {
  id: string;
  title: string;
  category: MissionCategory;
}

type TimeSlot = "morning" | "lunch" | "evening";

const SLOT_CONFIG: Record<TimeSlot, { hour: number; minute: number; body: string }> = {
  morning: { hour: 8, minute: 30, body: "Que tal começar o dia com uma ação de cuidado?" },
  lunch: { hour: 12, minute: 10, body: "Hora de uma pausa — uma missão rápida pode renovar sua energia." },
  evening: { hour: 17, minute: 0, body: "Hora de encerrar o dia com uma ação de gratidão ou cuidado." },
};

const SLOT_DEDUP_KEY = "lumina_mission_notif_sent";

const GRACE_WINDOW_MS = 30 * 60 * 1000;

function localTodayKey(): string {
  const now = devNow();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hasSentForSlot(slot: TimeSlot): boolean {
  try {
    const raw = localStorage.getItem(SLOT_DEDUP_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as Record<string, string[]>;
    const today = localTodayKey();
    return data[today]?.includes(slot) ?? false;
  } catch {
    return false;
  }
}

function markSlotSent(slot: TimeSlot): void {
  try {
    const raw = localStorage.getItem(SLOT_DEDUP_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const today = localTodayKey();
    if (!data[today]) data[today] = [];
    data[today].push(slot);
    const keys = Object.keys(data);
    if (keys.length > 3) {
      const oldest = keys.sort()[0];
      delete data[oldest];
    }
    localStorage.setItem(SLOT_DEDUP_KEY, JSON.stringify(data));
  } catch {
  }
}

function isInQuietHours(): boolean {
  const settings = loadSettings();
  const notif = settings.notifications;
  if (!notif.enabled || !notif.quietHoursEnabled) return false;

  const [startH, startM] = (notif.quietStart || "22:00").split(":").map(Number);
  const [endH, endM] = (notif.quietEnd || "07:00").split(":").map(Number);
  const now = devNow();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

function areMissionNotifsEnabled(): boolean {
  const settings = loadSettings();
  return settings.notifications.enabled && settings.notifications.types.mission !== false;
}

function pickMissionForSlot(missions: SelectedMissionForNotif[], slot: TimeSlot): SelectedMissionForNotif | null {
  if (missions.length === 0) return null;

  const slotCategories: Record<TimeSlot, MissionCategory[]> = {
    morning: ["movement", "breathing", "gym", "focus"],
    lunch: ["connection", "social", "hydration", "sensory"],
    evening: ["closure", "gratitude", "pause", "boundary"],
  };

  const preferred = slotCategories[slot];
  const match = missions.find((m) => preferred.includes(m.category));
  return match ?? missions[0];
}

function trySendSlot(slot: TimeSlot, config: typeof SLOT_CONFIG[TimeSlot], missions: SelectedMissionForNotif[]): void {
  if (isInQuietHours() || !areMissionNotifsEnabled()) return;
  if (hasSentForSlot(slot)) return;

  const mission = pickMissionForSlot(missions, slot);
  if (!mission) return;

  const sent = pushNotification("mission", mission.title, config.body);
  if (sent) {
    markSlotSent(slot);
  }
}

export function useMissionNotificationScheduler(missions: SelectedMissionForNotif[]) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!areMissionNotifsEnabled() || missions.length === 0) return;

    const now = devNow();
    const slots = Object.entries(SLOT_CONFIG) as [TimeSlot, typeof SLOT_CONFIG[TimeSlot]][];

    for (const [slot, config] of slots) {
      if (hasSentForSlot(slot)) continue;

      const target = new Date(now);
      target.setHours(config.hour, config.minute, 0, 0);
      const msUntil = target.getTime() - now.getTime();

      if (msUntil < 0) {
        const msSinceSlot = -msUntil;
        if (msSinceSlot <= GRACE_WINDOW_MS) {
          trySendSlot(slot, config, missions);
        }
        continue;
      }

      const timer = setTimeout(() => {
        trySendSlot(slot, config, missions);
      }, msUntil);

      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [missions]);
}
