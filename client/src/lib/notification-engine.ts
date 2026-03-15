/**
 * In-app notification engine — manages notification state in localStorage.
 *
 * Rules:
 * - Max 3 notifications per day
 * - Respects quiet hours setting
 * - No sensitive content in previews
 * - User can disable each type independently
 *
 * BACKLOG: replace with server-push when WebSocket layer is ready [future milestone]
 */
import { devNow } from "@shared/dev-clock";
// ── Types ─────────────────────────────────────────

export type NotificationType = "care" | "mission" | "microcheck" | "closure" | "support";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

// ── Storage ───────────────────────────────────────

const STORAGE_KEY = "lumina_notifications";
const LEGACY_STORAGE_KEY = "juphdcare_notifications";
const MAX_PER_DAY = 3;
const MAX_STORED = 20;

function todayKey(): string {
  return devNow().toISOString().slice(0, 10);
}

interface NotificationStore {
  items: AppNotification[];
  todayCount: { date: string; count: number };
}

function readStore(): NotificationStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { items: [], todayCount: { date: todayKey(), count: 0 } };
    return JSON.parse(raw) as NotificationStore;
  } catch (e: unknown) {
    console.warn("Failed to read notification store:", e);
    return { items: [], todayCount: { date: todayKey(), count: 0 } };
  }
}

function writeStore(store: NotificationStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

// ── Public API ────────────────────────────────────

/** Get all notifications, newest first. */
export function getNotifications(): AppNotification[] {
  return readStore().items;
}

/** Get unread count. */
export function getUnreadCount(): number {
  return readStore().items.filter((n) => !n.read).length;
}

/** Mark a single notification as read. */
export function markRead(id: string): void {
  const store = readStore();
  const item = store.items.find((n) => n.id === id);
  if (item) {
    item.read = true;
    writeStore(store);
  }
}

/** Mark all notifications as read. */
export function markAllRead(): void {
  const store = readStore();
  store.items.forEach((n) => { n.read = true; });
  writeStore(store);
}

/**
 * Push a new notification if daily limit not exceeded.
 * Returns true if added, false if suppressed.
 */
export function pushNotification(
  type: NotificationType,
  title: string,
  body: string,
): boolean {
  const store = readStore();
  const today = todayKey();

  // Reset daily counter if new day
  if (store.todayCount.date !== today) {
    store.todayCount = { date: today, count: 0 };
  }

  // Enforce daily limit
  if (store.todayCount.count >= MAX_PER_DAY) {
    return false;
  }

  const notification: AppNotification = {
    id: `${type}-${devNow().getTime()}`,
    type,
    title,
    body,
    timestamp: devNow().getTime(),
    read: false,
  };

  store.items.unshift(notification);
  store.todayCount.count++;

  // Cap stored notifications
  if (store.items.length > MAX_STORED) {
    store.items = store.items.slice(0, MAX_STORED);
  }

  writeStore(store);
  return true;
}

/** Clear all notifications. */
export function clearNotifications(): void {
  writeStore({ items: [], todayCount: { date: todayKey(), count: 0 } });
}

// ── Notification templates ────────────────────────

export const NOTIFICATION_TEMPLATES: Record<NotificationType, { icon: string; examples: string[] }> = {
  care: {
    icon: "💧",
    examples: ["Que tal um gole d'água?", "Uma pausa pode renovar sua energia"],
  },
  mission: {
    icon: "⭐",
    examples: ["Tem algo novo pra você", "Que tal uma atividade rápida?"],
  },
  microcheck: {
    icon: "💬",
    examples: ["Como você tá agora?", "10 segundos pra sentir como está"],
  },
  closure: {
    icon: "🌅",
    examples: ["Encerrar o dia leva menos de 20 segundos", "Hora de fechar o dia com calma"],
  },
  support: {
    icon: "🤝",
    examples: ["Talvez hoje valha desacelerar", "Uma mensagem de apoio está esperando por você"],
  },
};
