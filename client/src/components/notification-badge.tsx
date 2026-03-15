/**
 * NotificationBadge — bell icon with unread count dot.
 * Tapping opens the notification drawer.
 */

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { getUnreadCount } from "@/lib/notification-engine";

interface NotificationBadgeProps {
  readonly onClick: () => void;
  readonly className?: string;
}

export default function NotificationBadge({ onClick, className }: Readonly<NotificationBadgeProps>) {
  const [count, setCount] = useState(() => getUnreadCount());

  // Refresh count on focus (e.g. user returns from another tab)
  useEffect(() => {
    function refresh() { setCount(getUnreadCount()); }
    window.addEventListener("focus", refresh);
    // Also poll periodically for in-tab updates
    const iv = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(iv);
    };
  }, []);

  return (
    <button
      onClick={() => {
        onClick();
        // Re-read after opening
        setTimeout(() => setCount(getUnreadCount()), 300);
      }}
      className={`relative rounded-full border border-border/80 bg-card p-2 shadow-sm transition-colors hover:border-primary/20 hover:bg-primary/5 ${className ?? ""}`}
      data-testid="button-notifications"
      aria-label={count > 0 ? `Notificações (${count} não lidas)` : "Notificações"}
    >
      <Bell className="w-4 h-4 text-foreground/72" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-score-critical px-0.5 text-[10px] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
