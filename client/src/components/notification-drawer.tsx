/**
 * NotificationDrawer — slide-over panel listing recent in-app notifications.
 *
 * Uses shadcn Sheet component. Marks all as read on open.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Bell } from "lucide-react";
import { devNow } from "@shared/dev-clock";
import {
  getNotifications,
  markAllRead,
  markRead,
  type AppNotification,
  NOTIFICATION_TEMPLATES,
} from "@/lib/notification-engine";

interface NotificationDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

function timeAgo(ts: number): string {
  const diff = devNow().getTime() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function NotificationDrawer({ open, onClose }: Readonly<NotificationDrawerProps>) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (open) {
      setNotifications(getNotifications());
    }
  }, [open]);

  const handleMarkAllRead = () => {
    markAllRead();
    setNotifications(getNotifications());
  };

  const handleMarkRead = (id: string) => {
    markRead(id);
    setNotifications(getNotifications());
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-80 max-w-[85vw] flex-col border-l border-border-soft bg-card shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-foreground/70" />
            <h2 className="text-sm font-semibold tracking-[-0.02em]">Notificações</h2>
          </div>
          <div className="flex items-center gap-1">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="px-2 py-1 text-xs font-medium text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full border border-border/80 p-1.5 transition-colors hover:border-primary/20 hover:bg-primary/5"
            >
              <X className="h-4 w-4 text-foreground/70" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Bell className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Tudo tranquilo por aqui</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Novas notificações vão aparecer aqui
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-soft/50">
              {notifications.map((n) => {
                const template = NOTIFICATION_TEMPLATES[n.type];
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-full cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-surface-warm/70 ${
                      n.read ? "" : "bg-primary/5"
                    }`}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-base mt-0.5" role="img" aria-label={n.type}>
                        {template.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-sm tracking-[-0.01em] ${n.read ? "font-medium" : "font-semibold"}`}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                          {timeAgo(n.timestamp)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
