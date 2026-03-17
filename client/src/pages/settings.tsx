/**
 * Settings — notification preferences + profile section.
 *
 * Persists to localStorage key `lumina_settings`.
 * All UI text in PT-BR.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  GearSix, Bell, Moon, CaretLeft,
  Drop, Sparkle, ChatCircleDots, SunHorizon, Handshake,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { NotificationType } from "@/lib/notification-engine";

// ── Settings storage ──────────────────────────────

const SETTINGS_KEY = "lumina_settings";
const LEGACY_SETTINGS_KEY = "juphdcare_settings";

export interface NotificationPreferences {
  enabled: boolean;
  types: Record<NotificationType, boolean>;
  quietHoursEnabled: boolean;
  quietStart: string; // "HH:mm"
  quietEnd: string;   // "HH:mm"
  maxPerDay: number;
}

export interface AppSettings {
  notifications: NotificationPreferences;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    enabled: true,
    types: {
      care: true,
      mission: true,
      microcheck: true,
      closure: true,
      support: true,
    },
    quietHoursEnabled: false,
    quietStart: "22:00",
    quietEnd: "07:00",
    maxPerDay: 3,
  },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    return { ...structuredClone(DEFAULT_SETTINGS), ...JSON.parse(raw) };
  } catch (e: unknown) {
    console.warn("Failed to load settings:", e);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.removeItem(LEGACY_SETTINGS_KEY);
}

// ── Notification type labels ──────────────────────

const TYPE_META: Record<NotificationType, { label: string; description: string; Icon: PhosphorIcon; color: string }> = {
  care:       { label: "Cuidado",        description: "Lembretes leves pra você (água, pausas)",    Icon: Drop,            color: "text-brand-teal" },
  mission:    { label: "Pra Você",       description: "Novas atividades de autocuidado",            Icon: Sparkle,         color: "text-brand-gold" },
  microcheck: { label: "Micro check-in", description: "Leituras rápidas ao longo do dia",           Icon: ChatCircleDots,  color: "text-brand-navy" },
  closure:    { label: "Fechamento",     description: "Convite pra encerrar o dia",                 Icon: SunHorizon,      color: "text-score-attention" },
  support:    { label: "Apoio",          description: "Mensagens de suporte quando fizer sentido",  Icon: Handshake,       color: "text-score-good" },
};

// ── Component ─────────────────────────────────────

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Load settings from API on mount; merge into local state once
  const { data: remoteSettings } = useQuery<{ settings: string } | null>({
    queryKey: ["/api/users", user?.id, "settings"],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/settings`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ settings: string }>;
    },
  });

  useEffect(() => {
    if (!remoteSettings?.settings) return;
    try {
      const parsed: unknown = JSON.parse(remoteSettings.settings);
      if (typeof parsed !== "object" || parsed === null) return;
      const remote = parsed as Partial<AppSettings>;
      setSettings((prev) => ({ ...structuredClone(DEFAULT_SETTINGS), ...prev, ...remote }));
    } catch (error: unknown) {
      console.warn("Malformed remote settings:", error);
    }
  }, [remoteSettings]);

  const { mutate: rawSaveToApi } = useMutation({
    mutationFn: (json: string) =>
      apiRequest("PATCH", `/api/users/${user!.id}/settings`, { settings: json }),
  });
  const saveToApiRef = useRef(rawSaveToApi);
  saveToApiRef.current = rawSaveToApi;

  const apiTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist to localStorage immediately; debounce API sync
  const API_SYNC_DEBOUNCE_MS = 800;
  useEffect(() => {
    saveSettings(settings);
    if (!user?.id) return;
    clearTimeout(apiTimerRef.current);
    apiTimerRef.current = setTimeout(() => {
      saveToApiRef.current(JSON.stringify(settings));
    }, API_SYNC_DEBOUNCE_MS);
    return () => { clearTimeout(apiTimerRef.current); };
  }, [settings, user?.id]);

  const updateNotif = (patch: Partial<NotificationPreferences>) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...patch },
    }));
  };

  const toggleType = (type: NotificationType) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        types: {
          ...prev.notifications.types,
          [type]: !prev.notifications.types[type],
        },
      },
    }));
  };

  const firstName = user?.name?.split(" ")[0] || "Colaborador";

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/8 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-2 flex items-center gap-3 max-w-lg mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-lg hover:bg-black/5 transition-colors"
        >
          <CaretLeft className="w-5 h-5" weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <GearSix className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-base font-semibold">Configurações</h1>
        </div>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24 space-y-5 mt-4">
        {/* Profile section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-4"
        >
          <h2 className="text-xs font-semibold text-muted-foreground mb-3">Perfil</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-navy/10 flex items-center justify-center text-sm font-bold text-brand-navy">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
        </motion.section>

        {/* Notification master toggle */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground">Notificações</h2>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="notif-master" className="text-xs text-muted-foreground">
                {settings.notifications.enabled ? "Ativadas" : "Desativadas"}
              </Label>
              <Switch
                id="notif-master"
                checked={settings.notifications.enabled}
                onCheckedChange={(checked) => updateNotif({ enabled: checked })}
              />
            </div>
          </div>

          {/* Per-type toggles */}
          {settings.notifications.enabled && (
            <div className="space-y-3 mt-3 border-t border-border-soft pt-3">
              {(Object.keys(TYPE_META) as NotificationType[]).map((type) => {
                const meta = TYPE_META[type];
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <meta.Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} weight="fill" />
                      <div>
                        <p className="text-xs font-medium">{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">{meta.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.types[type]}
                      onCheckedChange={() => toggleType(type)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Quiet hours */}
        {settings.notifications.enabled && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-muted-foreground">Sem interrupções</h2>
              </div>
              <Switch
                checked={settings.notifications.quietHoursEnabled}
                onCheckedChange={(checked) => updateNotif({ quietHoursEnabled: checked })}
              />
            </div>

            {settings.notifications.quietHoursEnabled && (
              <div className="flex items-center gap-3 mt-3 border-t border-border-soft pt-3">
                <div className="flex-1">
                  <Label htmlFor="quiet-start" className="text-[10px] text-muted-foreground">
                    Início
                  </Label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={settings.notifications.quietStart}
                    onChange={(e) => updateNotif({ quietStart: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border-soft bg-white/70 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="quiet-end" className="text-[10px] text-muted-foreground">
                    Fim
                  </Label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={settings.notifications.quietEnd}
                    onChange={(e) => updateNotif({ quietEnd: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border-soft bg-white/70 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Logout */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button
            variant="outline"
            onClick={() => { void logout(); navigate("/"); }}
            className="w-full rounded-xl text-sm border-score-critical/20 text-score-critical hover:bg-score-critical/5"
          >
            Sair da conta
          </Button>
          <div className="privacy-note">
            <Moon className="w-3 h-3 inline mr-1 opacity-60" />
            Seus dados são protegidos e nunca compartilhados com sua empresa. Conforme NR-1 e LGPD.
          </div>
        </motion.section>

        {/* Brand footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-2 pt-4 pb-2"
        >
          <img
            src="/lumina-logo-circle.png"
            alt="Lumina"
            className="h-10 w-10 rounded-full opacity-70"
          />
          <p className="text-xs font-semibold tracking-widest text-muted-foreground/60 uppercase">
            Lumina
          </p>
          <p className="text-[10px] text-muted-foreground/40">
            Protegendo o que importa.
          </p>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
