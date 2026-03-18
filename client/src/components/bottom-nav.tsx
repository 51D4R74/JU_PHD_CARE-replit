import { useLocation } from "wouter";
import { Sun, Sparkle, ShieldWarning, Heart } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon?: PhosphorIcon;
  readonly imageSrc?: string;
  readonly burst?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: "/dashboard",   label: "Início",       icon: Sun },
  { path: "/missions",    label: "Pra Você",     icon: Sparkle },
  { path: "/denuncia",    label: "Riscos",        icon: ShieldWarning, burst: true },
  { path: "/support",     label: "Apoio",         icon: Heart },
  { path: "/meu-cuidado", label: "Sua Jornada",  imageSrc: "/icon-jornada.png" },
];

interface BottomNavProps {
  readonly variant?: "light" | "dark";
}

export default function BottomNav({ variant = "light" }: BottomNavProps) {
  const [location, navigate] = useLocation();

  const SECTION_ROUTES: Record<string, string[]> = {
    "/meu-cuidado": ["/meu-cuidado", "/report"],
    "/missions": ["/missions", "/team-challenge"],
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") return location === "/dashboard" || location === "/checkin";
    const aliases = SECTION_ROUTES[path];
    if (aliases) return aliases.some((r) => location.startsWith(r));
    return location.startsWith(path);
  };

  const isDark = variant === "dark";

  return (
    <nav
      className={isDark ? "fixed bottom-0 inset-x-0 z-20 glass-nav-dark" : "fixed bottom-0 inset-x-0 z-20 glass-card border-t border-border/30"}
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-lg mx-auto px-2 pt-3 pb-0 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);

          if (item.burst && item.icon) {
            const Icon = item.icon;
            const burstBorder = isDark ? "border-white/10" : "border-background";
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1.5 -mt-8 ${active ? (isDark ? "text-white" : "text-brand-navy") : (isDark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground")} transition-colors`}
              >
                <span className={`flex items-center justify-center w-14 h-14 rounded-full bg-brand-navy shadow-lg border-4 ${burstBorder}`}>
                  <Icon className="w-7 h-7 text-white" weight="bold" />
                </span>
                <span className={`text-[10px] leading-tight ${active ? "font-semibold" : ""}`}>{item.label}</span>
              </button>
            );
          }

          if (item.imageSrc) {
            const imgFilter = isDark
              ? "brightness(0) invert(1)"
              : active
                ? "brightness(0)"
                : "brightness(0) opacity(0.35)";

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex min-w-[56px] flex-col items-center gap-1.5 px-2 py-1 transition-colors ${
                  active
                    ? isDark ? "text-white" : "text-foreground"
                    : isDark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <img
                  src={item.imageSrc}
                  alt={item.label}
                  className="w-6 h-6 object-contain"
                  style={{ filter: imgFilter }}
                />
                <span className={`text-[11px] leading-tight ${active ? "font-semibold" : ""}`}>{item.label}</span>
              </button>
            );
          }

          if (item.icon) {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex min-w-[56px] flex-col items-center gap-1.5 px-2 py-1 ${active ? (isDark ? "text-white" : "text-foreground") : (isDark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground")} transition-colors`}
              >
                <Icon className="w-6 h-6" weight={active ? "fill" : "regular"} />
                <span className={`text-[11px] leading-tight ${active ? "font-semibold" : ""}`}>{item.label}</span>
              </button>
            );
          }

          return null;
        })}
      </div>
    </nav>
  );
}
