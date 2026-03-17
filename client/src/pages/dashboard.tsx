import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CaretRight, CheckCircle, Sparkle, BellRinging, DownloadSimple,
  ChatCircleDots, Heart, X,
} from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { useMutation, useQuery } from "@tanstack/react-query";
import SkyHero from "@/components/sky-hero";
import NotificationDrawer from "@/components/notification-drawer";
import InlineCheckin from "@/components/inline-checkin";
import JuPHDChatCard from "@/components/juphd-chat-card";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { fetchCurrentRelationalPulse, submitRelationalPulse } from "@/lib/pulse-client";
import { type TodayScores } from "@/lib/score-engine";
import { computeDiscoveries, DISCOVERY_MIN_RECORDS } from "@/lib/discovery-engine";
import { POINT_VALUES, selectMissions } from "@/lib/mission-engine";
import { getTodayLumens } from "@/lib/solar-points";
import { useMissionNotificationScheduler } from "@/hooks/use-mission-notification-scheduler";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UserMission, CheckInHistoryRecord } from "@shared/schema";
import { PULSE_DIMENSION_LABELS, PULSE_RESPONSE_OPTIONS, type CurrentPulseState, type PulseAnswerValue } from "@shared/pulse-survey";

// ── Celebration particles ─────────────────────────

const CELEBRATION_PARTICLES = [
  { angle: 0, distance: 44, delay: 0 },
  { angle: 45, distance: 38, delay: 0.05 },
  { angle: 90, distance: 46, delay: 0.02 },
  { angle: 135, distance: 40, delay: 0.08 },
  { angle: 180, distance: 44, delay: 0.03 },
  { angle: 225, distance: 36, delay: 0.07 },
  { angle: 270, distance: 42, delay: 0.01 },
  { angle: 315, distance: 39, delay: 0.04 },
] as const;

function CelebrationParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {CELEBRATION_PARTICLES.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.cos(rad) * p.distance;
        const y = Math.sin(rad) * p.distance;
        return (
          <motion.div
            key={p.angle}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: 0.2, x, y }}
            transition={{ duration: 0.75, delay: p.delay, ease: "easeOut" }}
            className={`absolute left-1/2 top-1/2 rounded-full ${
              i % 2 === 0 ? "h-1.5 w-1.5 bg-brand-gold" : "h-1 w-1 bg-warmth-coral"
            }`}
          />
        );
      })}
    </div>
  );
}

const EMPTY_SCORES: TodayScores = {
  domainScores: { recarga: 0, "estado-do-dia": 0, "seguranca-relacional": 0 },
  skyState: "partly-cloudy",
  solarHaloLevel: 0.5,
  flags: [],
  hasCheckedIn: false,
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const PULSE_DISMISS_KEY = "lumina_dismissed_pulse_window";
const LEGACY_PULSE_DISMISS_KEY = "juphdcare_dismissed_pulse_window";
const CHECKIN_REMINDER_KEY = "lumina_checkin_reminder_date";
const LEGACY_CHECKIN_REMINDER_KEY = "juphdcare_checkin_reminder_date";
const SETTINGS_KEY = "lumina_settings";
const LEGACY_SETTINGS_KEY = "juphdcare_settings";
const REMINDER_CARD_DISMISSED_KEY = "lumina_reminder_card_dismissed";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadLastCheckinReminderDate(): string | null {
  if (globalThis.window === undefined) {
    return null;
  }

  return localStorage.getItem(CHECKIN_REMINDER_KEY) ?? localStorage.getItem(LEGACY_CHECKIN_REMINDER_KEY);
}

function saveLastCheckinReminderDate(date: string): void {
  if (globalThis.window === undefined) {
    return;
  }

  localStorage.setItem(CHECKIN_REMINDER_KEY, date);
  localStorage.removeItem(LEGACY_CHECKIN_REMINDER_KEY);
}

function isStandaloneMode(): boolean {
  if (globalThis.window === undefined) {
    return false;
  }

  const nav = navigator as Navigator & { standalone?: boolean };
  return globalThis.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function canSendCheckinReminders(): boolean {
  if (globalThis.window === undefined) {
    return false;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) {
      return true;
    }

    const parsed = JSON.parse(raw) as {
      readonly notifications?: {
        readonly enabled?: boolean;
        readonly types?: { readonly microcheck?: boolean };
        readonly quietHoursEnabled?: boolean;
        readonly quietStart?: string;
        readonly quietEnd?: string;
      };
    };

    const notifications = parsed.notifications;
    if (notifications?.enabled === false || notifications?.types?.microcheck === false) {
      return false;
    }

    if (notifications?.quietHoursEnabled === true) {
      const [startHour, startMinute] = (notifications.quietStart ?? "22:00").split(":").map(Number);
      const [endHour, endMinute] = (notifications.quietEnd ?? "07:00").split(":").map(Number);
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const inQuietHours = startMinutes <= endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;

      if (inQuietHours) {
        return false;
      }
    }

    return true;
  } catch {
    return true;
  }
}

function loadDismissedPulseWindow(): string | null {
  if (globalThis.window === undefined) {
    return null;
  }

  return localStorage.getItem(PULSE_DISMISS_KEY) ?? localStorage.getItem(LEGACY_PULSE_DISMISS_KEY);
}

function saveDismissedPulseWindow(windowStart: string | null): void {
  if (globalThis.window === undefined) {
  localStorage.removeItem(LEGACY_PULSE_DISMISS_KEY);
    return;
  }

  if (windowStart === null) {
    localStorage.removeItem(PULSE_DISMISS_KEY);
    return;
  }

  localStorage.setItem(PULSE_DISMISS_KEY, windowStart);
}

function getActivePulseWindowId(state: CurrentPulseState): string {
  if (state.isDue) {
    return state.window.windowStart;
  }

  return state.latestResponse?.windowStart ?? state.window.windowStart;
}



function formatShortDate(date: string | null): string {
  if (date === null) {
    return "agora";
  }

  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function getPulseLeadText(state: CurrentPulseState): string {
  if (state.isDue) {
    return `Janela aberta até ${formatShortDate(state.window.windowEnd)}.`;
  }

  return `Próxima janela prevista para ${formatShortDate(state.nextEligibleAt)}.`;
}

function getPulseCompletionCount(
  answers: Readonly<Record<string, PulseAnswerValue>>,
  questionIds: readonly string[],
): number {
  return questionIds.filter((questionId) => answers[questionId] !== undefined).length;
}

function getCheckInStatusCopy(justCompleted: boolean): { title: string; description: string } {
  if (justCompleted) {
    return {
      title: "Pronto! Seu dia está registrado.",
      description: "Tudo certo por hoje — obrigado por se cuidar.",
    };
  }

  return {
      title: "Tudo certo por hoje",
      description: "Seus sinais estão atualizados.",
  };
}

function getPulseCardTone(isDue: boolean): { container: string; badge: string; icon: string } {
  if (isDue) {
    return {
      container: "border-brand-teal/20 hover:border-brand-teal/35 hover:bg-brand-teal/5",
      badge: "bg-brand-teal/12 text-brand-teal",
      icon: "bg-brand-teal/12 text-brand-teal",
    };
  }

  return {
    container: "border-border/70",
    badge: "bg-primary/8 text-primary",
    icon: "bg-primary/8 text-primary",
  };
}

function PulseCard({
  pulseState,
  onOpen,
  onDismiss,
  canDismiss,
}: Readonly<{
  pulseState: CurrentPulseState;
  onOpen: () => void;
  onDismiss: () => void;
  canDismiss: boolean;
}>) {
  const [, navigate] = useLocation();
  const tone = getPulseCardTone(pulseState.isDue);
  const estimatedMinutes = Math.round(pulseState.definition.estimatedSeconds / 60);
  const bodyCopy = pulseState.isDue
    ? `${pulseState.definition.description} ${getPulseLeadText(pulseState)} ${pulseState.definition.questions.length} itens, cerca de ${estimatedMinutes} minuto.`
    : `Respondida neste ciclo. Toque para ver seu resultado.`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.43 }}
      className="mt-4"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate("/meu-cuidado?section=pulse")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/meu-cuidado?section=pulse"); }}
        className={`w-full cursor-pointer rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition-colors ${tone.container}`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
            <ChatCircleDots className="h-5 w-5" weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pesquisa mensal
                </p>
                <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-foreground">
                  {pulseState.definition.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                  {pulseState.isDue ? "Disponível" : "Respondida"}
                </span>
                {canDismiss ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    aria-label="Dispensar"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" weight="bold" />
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {bodyCopy}
            </p>

            {pulseState.isDue && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className="mt-3 flex items-center gap-2 text-sm font-medium text-brand-teal"
              >
                <span>Responder agora</span>
                <CaretRight className="h-4 w-4" weight="bold" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}


// ── Extracted section components (reduces DashboardPage cognitive complexity) ──

function CheckedInCard({ justCompleted, statusCopy }: Readonly<{
  justCompleted: boolean;
  statusCopy: { readonly title: string; readonly description: string };
}>) {
  return (
    <motion.div
      initial={justCompleted ? { scale: 0.92, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="relative flex items-center gap-3 rounded-2xl border border-score-good/20 bg-card p-4 shadow-sm"
    >
      {justCompleted && <CelebrationParticles />}
      <motion.div
        initial={justCompleted ? { rotate: -90, scale: 0 } : false}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-score-good/12"
      >
        {justCompleted ? (
          <Sparkle className="w-5 h-5 text-score-good" weight="fill" />
        ) : (
          <CheckCircle className="w-5 h-5 text-score-good" weight="fill" />
        )}
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold tracking-[-0.02em] text-foreground">
          {statusCopy.title}
        </p>
        <p className="text-sm text-muted-foreground">
          {statusCopy.description}
        </p>
      </div>
    </motion.div>
  );
}

function ReminderActivationCard({ onEnable }: Readonly<{ onEnable: () => void }>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34 }}
      className="mt-3"
    >
      <div className="rounded-2xl border border-brand-teal/20 bg-card px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-teal/10">
            <BellRinging className="h-5 w-5 text-brand-teal" weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Ative o lembrete do check-in
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando o check-in do dia abrir, o JuPHD Care pode te avisar sem você precisar caçar a tela.
            </p>
            <Button
              type="button"
              onClick={onEnable}
              className="mt-3 rounded-full bg-gradient-to-r from-brand-teal to-brand-navy px-5 text-white hover:opacity-90"
            >
              Ativar lembretes
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function InstallAppCard({ onInstall }: Readonly<{ onInstall: () => void }>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.36 }}
      className="mt-3"
    >
      <div className="rounded-2xl border border-brand-navy/15 bg-card px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-navy/10">
            <DownloadSimple className="h-5 w-5 text-brand-navy" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Instale o Lumina como app
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Assim o Lumina abre direto no celular, em tela cheia, com menos atrito no seu dia a dia.
            </p>
            <Button type="button" variant="outline" onClick={onInstall} className="mt-3 rounded-xl border-brand-navy/20 text-brand-navy hover:bg-brand-navy/5">
              Instalar app
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function DiscoveryCard({ discovery }: Readonly<{
  discovery: { readonly text: string; readonly withCount: number };
}>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
      className="mt-4 rounded-2xl border border-brand-teal/15 bg-card px-4 py-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-teal/12">
          <Sparkle className="h-4 w-4 text-brand-teal" weight="fill" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Descoberta privada
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {discovery.text}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            Baseado em {discovery.withCount} dias · Só você vê isso
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function DiscoveryProgressTeaser({ progress, threshold }: Readonly<{
  progress: number;
  threshold: number;
}>) {
  const remaining = threshold - progress;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
      className="mt-4 rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8">
          <Sparkle className="h-3.5 w-3.5 text-primary/60" weight="fill" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {remaining} check-in{remaining > 1 ? "s" : ""} até sua primeira descoberta privada
          </p>
          <div className="mt-1.5 h-1 rounded-full bg-primary/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round((progress / threshold) * 100)}%` }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="h-full rounded-full bg-primary/40"
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function CrisisSupportCTA({ onNavigate }: Readonly<{ onNavigate: () => void }>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="mt-3"
    >
      <button
        onClick={onNavigate}
        className="flex w-full items-center gap-3 rounded-2xl border border-score-attention/20 bg-card p-4 text-left shadow-sm transition-colors hover:border-score-attention/30"
        data-testid="button-crisis-support"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-score-attention/14">
          <Heart className="w-5 h-5 text-score-attention" weight="fill" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold tracking-[-0.02em]">Tô aqui se precisar.</p>
          <p className="text-sm text-muted-foreground">
            Apoio e acolhimento quando quiser
          </p>
        </div>
        <CaretRight className="w-4 h-4 text-muted-foreground flex-shrink-0" weight="bold" />
      </button>
    </motion.section>
  );
}

function PulseDialog({
  pulseState,
  open,
  onOpenChange,
  answers,
  onAnswer,
  answeredCount,
  totalCount,
  canSubmit,
  isPending,
  onSubmit,
}: Readonly<{
  pulseState: CurrentPulseState;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  answers: Readonly<Record<string, PulseAnswerValue>>;
  onAnswer: (questionId: string, value: PulseAnswerValue) => void;
  answeredCount: number;
  totalCount: number;
  canSubmit: boolean;
  isPending: boolean;
  onSubmit: () => void;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl border-border/70 px-0 pb-0 pt-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>{pulseState.definition.title}</DialogTitle>
          <DialogDescription>
            Responda pensando nas últimas duas semanas. A pesquisa é privada e ajuda a entender melhor seu momento de trabalho.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Progresso do pulse
              </p>
              <p className="text-xs text-muted-foreground">
                {answeredCount} de {totalCount} itens respondidos
              </p>
            </div>
            <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              Até {formatShortDate(pulseState.window.windowEnd)}
            </span>
          </div>

          <div className="space-y-4 pb-5">
            {pulseState.definition.questions.map((question, index) => (
              <section
                key={question.id}
                className="rounded-2xl border border-border/65 bg-background px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {PULSE_DIMENSION_LABELS[question.dimension]}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                      {index + 1}. {question.prompt}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PULSE_RESPONSE_OPTIONS.map((option) => {
                    const selected = answers[question.id] === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onAnswer(question.id, option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${selected ? "border-brand-teal/40 bg-brand-teal/10 text-foreground" : "border-border/60 bg-card text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
          >
            {isPending ? "Enviando..." : "Concluir pulse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getInitialNotificationPermission(): NotificationPermission {
  if (typeof Notification === "undefined") {
    return "default";
  }

  return Notification.permission;
}

function useCheckinReminderNotification(
  checkedIn: boolean,
  permission: NotificationPermission,
  lastDate: string | null,
  onSent: (date: string) => void,
) {
  useEffect(() => {
    if (checkedIn || permission !== "granted") {
      return;
    }

    if (!canSendCheckinReminders()) {
      return;
    }

    const today = todayKey();
    if (lastDate === today) {
      return;
    }

    const reminder = new Notification("Seu check-in de hoje está pronto", {
      body: "Leva menos de 1 minuto. Abra o Lumina e responda no melhor momento do seu dia.",
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: `checkin-${today}`,
    });

    reminder.onclick = () => {
      globalThis.focus();
    };

    saveLastCheckinReminderDate(today);
    onSent(today);
  }, [checkedIn, lastDate, permission, onSent]);
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? "";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pulseDialogOpen, setPulseDialogOpen] = useState(false);
  const [pulseAnswers, setPulseAnswers] = useState<Record<string, PulseAnswerValue>>({});
  const [dismissedPulseWindow, setDismissedPulseWindow] = useState<string | null>(() => loadDismissedPulseWindow());
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(getInitialNotificationPermission);
  const [lastCheckinReminderDate, setLastCheckinReminderDate] = useState<string | null>(() => loadLastCheckinReminderDate());
  const [reminderCardDismissed, setReminderCardDismissed] = useState<boolean>(() =>
    localStorage.getItem(REMINDER_CARD_DISMISSED_KEY) === "1",
  );
  // Track local completion to show celebration immediately (before server refetch)
  const [justCompleted, setJustCompleted] = useState(false);

  // Lumens — today's points from dailyLog (single source of truth across all pages)
  const [todayLumens, setTodayLumens] = useState(() => getTodayLumens());

  const { data: scores = EMPTY_SCORES } = useQuery<TodayScores>({
    queryKey: ["/api/scores/user", userId, "today"],
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });

  const { data: todayMissions = [] } = useQuery<UserMission[]>({
    queryKey: ["/api/missions", userId, "today"],
    enabled: !!userId,
  });

  const { data: history = [] } = useQuery<CheckInHistoryRecord[]>({
    queryKey: ["/api/checkins/user", userId, "history"],
    queryFn: () =>
      fetch(`/api/checkins/user/${userId}/history?days=10`, { credentials: "include" })
        .then((r) => r.json()) as Promise<CheckInHistoryRecord[]>,
    enabled: !!userId,
  });

  const { data: discoveryHistory = [] } = useQuery<CheckInHistoryRecord[]>({
    queryKey: ["/api/checkins/user", userId, "discovery-history"],
    queryFn: () =>
      fetch(`/api/checkins/user/${userId}/history?days=30`, { credentials: "include" })
        .then((r) => r.json()) as Promise<CheckInHistoryRecord[]>,
    enabled: !!userId,
  });

  const { data: pulseState } = useQuery<CurrentPulseState>({
    queryKey: ["/api/pulses/user", userId, "current"],
    queryFn: () => fetchCurrentRelationalPulse(userId),
    enabled: !!userId,
  });

  const checkedInDates = history.map((h) => h.date);

  const checkedIn = scores.hasCheckedIn || justCompleted;
  const CRISIS_THRESHOLD = 25;
  const hasCrisisSignal = checkedIn && Object.values(scores.domainScores).some(
    (s) => s < CRISIS_THRESHOLD,
  );

  const missionPointsToday = todayMissions.reduce((sum, m) => sum + m.pointsEarned, 0);
  const solarPoints = todayLumens + missionPointsToday;

  useEffect(() => {
    if (pulseDialogOpen) {
      setPulseAnswers({});
    }
  }, [pulseDialogOpen, pulseState?.window.windowStart]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
    };

    globalThis.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    globalThis.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      globalThis.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      globalThis.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const submitPulseMutation = useMutation({
    mutationFn: async () => {
      if (!pulseState?.isDue) {
        throw new Error("Pulse indisponível neste momento.");
      }

      await submitRelationalPulse({
        userId,
        windowStart: pulseState.window.windowStart,
        windowEnd: pulseState.window.windowEnd,
        answers: pulseState.definition.questions.map((question) => ({
          questionId: question.id,
          value: pulseAnswers[question.id],
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/pulses/user", userId, "current"] });
      setPulseDialogOpen(false);
      setPulseAnswers({});
      saveDismissedPulseWindow(null);
      setDismissedPulseWindow(null);
      toast({
        title: "Leitura registrada",
        description: `Obrigado por compartilhar. Você ganhou ${POINT_VALUES.pulseSurvey} Lumens ☀️`,
      });
    },
    onError: (error: unknown) => {
      const description = error instanceof Error
        ? error.message.replace(/^\d+:\s*/, "")
        : "Não conseguimos registrar agora. Tente de novo em instantes.";
      toast({
        title: "Algo deu errado",
        description,
        variant: "destructive",
      });
    },
  });

  const handleCheckinComplete = useCallback(() => {
    setTodayLumens(getTodayLumens());
    setJustCompleted(true);
    navigate("/meu-cuidado");
  }, [navigate]);

  const handlePulseAnswer = useCallback((questionId: string, value: PulseAnswerValue) => {
    setPulseAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const handleDismissPulse = useCallback(() => {
    if (!pulseState?.latestResponse) {
      return;
    }

    const activeWindowId = getActivePulseWindowId(pulseState);
    saveDismissedPulseWindow(activeWindowId);
    setDismissedPulseWindow(activeWindowId);
  }, [pulseState]);

  const handleEnableReminders = useCallback(async () => {
    localStorage.setItem(REMINDER_CARD_DISMISSED_KEY, "1");
    setReminderCardDismissed(true);

    if (typeof Notification === "undefined") {
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      toast({
        title: "Lembretes ativados",
        description: "Vamos te avisar quando o check-in do dia estiver disponível.",
      });
      return;
    }

    toast({
      title: "Tudo certo",
      description: "Se quiser ativar depois, é só acessar as permissões do navegador.",
    });
  }, [toast]);

  const handleInstallApp = useCallback(async () => {
    if (!installPromptEvent) {
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPromptEvent(null);
    }
  }, [installPromptEvent]);

  const firstName = user?.name?.split(" ")[0] || "Colaborador";

  const discoveries = useMemo(() => computeDiscoveries(discoveryHistory), [discoveryHistory]);
  const featuredDiscovery = discoveries.length > 0 ? discoveries[0] : null;
  const discoveryProgress = discoveryHistory.length;
  const pulseQuestionIds = pulseState?.definition.questions.map((question) => question.id) ?? [];
  const pulseAnsweredCount = getPulseCompletionCount(pulseAnswers, pulseQuestionIds);
  const canSubmitPulse = pulseState?.isDue === true
    && pulseAnsweredCount === pulseQuestionIds.length
    && pulseQuestionIds.length > 0;
  const checkInStatusCopy = getCheckInStatusCopy(justCompleted);
  const activePulseWindowId = pulseState ? getActivePulseWindowId(pulseState) : null;
  const shouldShowPulseCard = pulseState !== undefined && dismissedPulseWindow !== activePulseWindowId;
  const shouldOfferReminderActivation = !checkedIn
    && !reminderCardDismissed
    && typeof Notification !== "undefined"
    && notificationPermission !== "granted"
    && canSendCheckinReminders();
  const shouldOfferInstall = !isStandalone && installPromptEvent !== null;

  const handleReminderSent = useCallback((date: string) => {
    setLastCheckinReminderDate(date);
  }, []);
  useCheckinReminderNotification(checkedIn, notificationPermission, lastCheckinReminderDate, handleReminderSent);

  const schedulerMissions = useMemo(() => {
    const completedIds = todayMissions.map((m) => m.missionId);
    return selectMissions({
      skyState: scores.skyState,
      domainScores: scores.domainScores,
      flags: scores.flags,
      recentMissionIds: completedIds,
    });
  }, [scores.skyState, scores.domainScores, scores.flags, todayMissions]);
  useMissionNotificationScheduler(schedulerMissions);

  return (
    <div className="min-h-screen bg-background">
      {/* Fullbleed sky hero */}
      <SkyHero
        firstName={firstName}
        scores={scores}
        solarPoints={solarPoints}
        checkedInDates={checkedInDates}
        onOpenNotifications={() => setDrawerOpen(true)}
        onOpenSettings={() => navigate("/settings")}
        onNavigateDomains={() => navigate("/meu-cuidado?section=domains")}
      />

      <AnimatePresence>
        {drawerOpen && (
          <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto max-w-lg px-4 pb-24 pt-5">
        <JuPHDChatCard
          message={hasCrisisSignal
            ? "Percebi que algo te incomodou. Estou aqui pra ouvir, sem julgamento."
            : "Como foi até agora? Quero entender melhor o seu momento."}
          delay={0.32}
          className="relative z-10"
        />

        {/* Inline check-in OR post-check-in celebration */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className={checkedIn ? "mt-5" : "mt-5 rounded-[30px] ring-2 ring-brand-gold/20 ring-offset-4 ring-offset-background"}
        >
          {checkedIn ? null : (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-brand-gold/20 bg-brand-gold/8 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">
                  Check-in do dia
                </p>
                <p className="text-sm text-foreground">
                  Sono, humor, energia e relações. Seis perguntas que atualizam seu céu.
                </p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-brand-navy">
                Menos de 1 min
              </span>
            </div>
          )}

          {checkedIn ? (
            <CheckedInCard justCompleted={justCompleted} statusCopy={checkInStatusCopy} />
          ) : (
            <InlineCheckin
              userId={userId}
              onComplete={handleCheckinComplete}
              onNavigateProtection={() => navigate("/denuncia")}
            />
          )}
        </motion.section>

        {shouldOfferReminderActivation ? (
          <ReminderActivationCard onEnable={handleEnableReminders} />
        ) : null}

        {shouldOfferInstall ? (
          <InstallAppCard onInstall={handleInstallApp} />
        ) : null}

        {/* Discovery card — 1 private insight from correlation engine */}
        {checkedIn && featuredDiscovery && (
          <DiscoveryCard discovery={featuredDiscovery} />
        )}

        {/* Discovery progress teaser — before threshold */}
        {checkedIn && !featuredDiscovery && discoveryProgress > 0 && discoveryProgress < DISCOVERY_MIN_RECORDS && (
          <DiscoveryProgressTeaser progress={discoveryProgress} threshold={DISCOVERY_MIN_RECORDS} />
        )}

        {shouldShowPulseCard && pulseState && (
          <PulseCard
            pulseState={pulseState}
            onOpen={() => {
              if (pulseState.isDue) {
                setPulseDialogOpen(true);
              }
            }}
            onDismiss={handleDismissPulse}
            canDismiss={pulseState.latestResponse !== null && !pulseState.isDue}
          />
        )}

        {/* Crisis-aware support CTA */}
        {hasCrisisSignal && (
          <CrisisSupportCTA onNavigate={() => navigate("/support")} />
        )}
      </main>

      {pulseState && (
        <PulseDialog
          pulseState={pulseState}
          open={pulseDialogOpen}
          onOpenChange={setPulseDialogOpen}
          answers={pulseAnswers}
          onAnswer={handlePulseAnswer}
          answeredCount={pulseAnsweredCount}
          totalCount={pulseQuestionIds.length}
          canSubmit={canSubmitPulse}
          isPending={submitPulseMutation.isPending}
          onSubmit={() => submitPulseMutation.mutate()}
        />
      )}

      <BottomNav variant="dark" />

    </div>
  );
}
