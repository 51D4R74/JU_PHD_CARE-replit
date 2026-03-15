/**
 * InlineCheckin — progressive check-in embedded directly in the dashboard.
 *
 * Shows one question at a time with horizontal slide transitions.
 * Single-select options auto-advance on tap. Multi-select / tags show
 * a "Continuar" button. Partial answers are persisted to localStorage
 * so closing the app doesn't lose progress.
 *
 * After Q6 the component calls `onComplete` and the dashboard takes over.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, MessageCircle } from "lucide-react";
import { devNow } from "@shared/dev-clock";
import { Button } from "@/components/ui/button";
import {
  type CheckInStep,
  type StepOption,
  type ProjectionOption,
  type ProjectionCard,
  getTimeAwareSteps,
  detectChatTrigger,
  CHAT_TRIGGERS,
} from "@/lib/checkin-data";
import { computeCheckInResult } from "@/lib/score-engine";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Persistence helpers ───────────────────────────

const PARTIAL_KEY = "lumina_checkin_partial";
const LEGACY_PARTIAL_KEY = "juphdcare_checkin_partial";

interface PartialState {
  readonly date: string;
  readonly answers: Record<string, string | string[]>;
  readonly step: number;
  readonly abandonedAtQuestion?: number;
}

function todayISO(): string {
  return devNow().toISOString().slice(0, 10);
}

function loadPartial(): PartialState | null {
  try {
    const raw = localStorage.getItem(PARTIAL_KEY) ?? localStorage.getItem(LEGACY_PARTIAL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.date !== todayISO()) {
      localStorage.removeItem(PARTIAL_KEY);
      return null;
    }
    return parsed as PartialState;
  } catch (e: unknown) {
    console.error("Partial check-in data corrupted, resetting:", e);
    localStorage.removeItem(PARTIAL_KEY);
    return null;
  }
}

function savePartial(state: PartialState): void {
  localStorage.setItem(PARTIAL_KEY, JSON.stringify(state));
  localStorage.removeItem(LEGACY_PARTIAL_KEY);
}

function clearPartial(): void {
  localStorage.removeItem(PARTIAL_KEY);
  localStorage.removeItem(LEGACY_PARTIAL_KEY);
}

// ── Slide variants (horizontal) ───────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 280 : -280, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -280 : 280, opacity: 0 }),
};

// ── Sub-components ────────────────────────────────

function InlineGridCard({
  option,
  selected,
  onClick,
}: Readonly<{
  option: StepOption;
  selected: boolean;
  onClick: () => void;
}>) {
  const Icon = option.icon;
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all border py-4 px-2 ${
        selected
          ? "border-primary/40 bg-primary/8"
          : "glass-card hover:border-black/5"
      }`}
    >
      <div
        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${option.bgColor} ring-1 ring-black/5 flex items-center justify-center`}
      >
        <Icon className={`w-7 h-7 ${option.color}`} />
      </div>
      <span
        className={`text-[11px] leading-tight text-center font-medium ${
          selected ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {option.label}
      </span>
      {selected && (
        <motion.div
          layoutId="inline-grid-check"
          className="absolute top-2 right-2"
        >
          <Check className="w-3.5 h-3.5 text-primary" />
        </motion.div>
      )}
    </motion.button>
  );
}

function InlineOptionCard({
  option,
  selected,
  onClick,
  compact,
}: Readonly<{
  option: StepOption;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}>) {
  const Icon = option.icon;
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 rounded-xl transition-all border ${
        compact ? "p-2.5" : "p-3"
      } ${
        selected
          ? "border-primary/40 bg-primary/8"
          : "glass-card hover:border-black/5"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg bg-gradient-to-br ${option.bgColor} ring-1 ring-black/5 flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-4 h-4 ${option.color}`} />
      </div>
      <span
        className={`text-sm leading-tight ${
          selected ? "font-semibold text-foreground" : "text-foreground"
        }`}
      >
        {option.label}
      </span>
      {selected && (
        <motion.div layoutId="inline-check" className="ml-auto">
          <Check className="w-4 h-4 text-primary" />
        </motion.div>
      )}
    </motion.button>
  );
}

function InlineTagPill({
  option,
  selected,
  onClick,
}: Readonly<{
  option: StepOption;
  selected: boolean;
  onClick: () => void;
}>) {
  const Icon = option.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
        selected
          ? "bg-primary/10 border border-primary/30 text-primary font-medium"
          : "glass-card hover:border-black/5 text-muted-foreground"
      }`}
    >
      <Icon className="w-3 h-3" />
      {option.label}
    </button>
  );
}

function InlineProjectionCard({
  card,
  onAnswer,
  selected,
}: Readonly<{
  card: ProjectionCard;
  onAnswer: (opt: ProjectionOption) => void;
  selected: string | null;
}>) {
  return (
    <div className="mt-3 p-3 rounded-xl border border-dashed border-accent/30 bg-accent/5">
      <div className="flex items-start gap-2 mb-2">
        <MessageCircle className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground leading-snug">
            {card.text}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{card.sublabel}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {card.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onAnswer(opt)}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] transition-all border ${
              selected === opt.id
                ? "border-primary/30 bg-primary/8 font-semibold text-foreground"
                : "glass-card text-muted-foreground hover:border-black/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Chat trigger inline prompt ────────────────────

function InlineChatPrompt({
  triggerId,
  onDismiss,
  onNavigate,
}: Readonly<{
  triggerId: string;
  onDismiss: () => void;
  onNavigate: () => void;
}>) {
  const t = CHAT_TRIGGERS[triggerId] ?? CHAT_TRIGGERS.pressured;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-card rounded-2xl p-4 border border-accent/20"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-accent" />
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
          {t.message}
        </p>
      </div>
      <p className="text-xs text-muted-foreground/80 mb-3 flex items-center gap-1.5">
        <Lock className="w-3 h-3" /> {t.anonymousNote}
      </p>
      <div className="flex gap-2">
        <Button
          onClick={onNavigate}
          size="sm"
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl border-0 h-9 text-xs"
        >
          {t.cta}
        </Button>
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-9"
        >
          Agora não
        </Button>
      </div>
    </motion.div>
  );
}

// ── StepView (inline, compact) ────────────────────

function InlineStepView({
  step,
  onAnswer,
  previousAnswer,
}: Readonly<{
  step: CheckInStep;
  onAnswer: (
    stepId: string,
    answer: string | string[],
    projAnswer?: ProjectionOption | null,
  ) => void;
  previousAnswer?: string | string[];
}>) {
  const isMultiType = step.type === "multi2" || step.type === "multi3" || step.type === "tags";
  const [selected, setSelected] = useState<string | string[]>(
    previousAnswer ?? (isMultiType ? [] : ""),
  );
  const [projAnswer, setProjAnswer] = useState<ProjectionOption | null>(null);

  const handleSingle = (opt: StepOption) => {
    setSelected(opt.id);
    // Auto-advance after brief visual feedback
    setTimeout(() => onAnswer(step.id, opt.id, projAnswer), 300);
  };

  const handleMulti = (opt: StepOption, max: number) => {
    if (opt.exclusive) {
      setSelected([opt.id]);
      return;
    }
    let next = Array.isArray(selected)
      ? selected.filter((s) => s !== "nothing" && s !== "all_good")
      : [];
    if (next.includes(opt.id)) {
      next = next.filter((s) => s !== opt.id);
    } else if (next.length < max) {
      next = [...next, opt.id];
    }
    setSelected(next);
  };

  const isMultiSelected = (id: string) =>
    Array.isArray(selected) && selected.includes(id);
  const canContinue = Array.isArray(selected)
    ? selected.length > 0
    : selected !== "";

  return (
    <div className="flex flex-col gap-3">
      {/* Question */}
      <div>
        <h3 className="text-base font-bold text-foreground leading-tight">
          {step.question}
        </h3>
        {step.sublabel && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            {step.sublabel}
          </p>
        )}
      </div>

      {/* Single / Projection — 2×2 grid with icon-dominant cards */}
      {(step.type === "single" || step.type === "projection") && (
        <div className="grid grid-cols-2 gap-2.5">
          {step.options.map((opt) => (
            <InlineGridCard
              key={opt.id}
              option={opt}
              selected={selected === opt.id}
              onClick={() => handleSingle(opt)}
            />
          ))}
        </div>
      )}

      {/* Multi2 / Multi3 */}
      {(step.type === "multi2" || step.type === "multi3") && (
        <div className="flex flex-col gap-1.5">
          {step.options.map((opt) => (
            <InlineOptionCard
              key={opt.id}
              option={opt}
              selected={isMultiSelected(opt.id)}
              onClick={() => handleMulti(opt, step.type === "multi3" ? 3 : 2)}
              compact
            />
          ))}
          {step.projectionCard && (
            <InlineProjectionCard
              card={step.projectionCard}
              onAnswer={setProjAnswer}
              selected={projAnswer?.id ?? null}
            />
          )}
          {canContinue && (
            <Button
              onClick={() => onAnswer(step.id, selected, projAnswer)}
              size="sm"
              className="mt-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl border-0 text-sm"
            >
              Continuar
            </Button>
          )}
        </div>
      )}

      {/* Tags */}
      {step.type === "tags" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {step.options.map((opt) => (
              <InlineTagPill
                key={opt.id}
                option={opt}
                selected={isMultiSelected(opt.id)}
                onClick={() => handleMulti(opt, 5)}
              />
            ))}
          </div>
          <Button
            onClick={() => onAnswer(step.id, selected, projAnswer)}
            size="sm"
            className={`h-10 rounded-xl border-0 font-semibold text-sm ${
              canContinue
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-background/40 text-muted-foreground"
            }`}
          >
            {canContinue ? "Continuar" : "Pular"}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────

interface InlineCheckinProps {
  readonly userId: string;
  readonly onComplete: () => void;
  readonly onNavigateProtection: () => void;
}

export default function InlineCheckin({
  userId,
  onComplete,
  onNavigateProtection,
}: Readonly<InlineCheckinProps>) {
  const { toast } = useToast();
  const steps = getTimeAwareSteps();

  // Track timing for confidence score: faster + consistent = higher confidence
  const startTime = useRef(Date.now());
  const abandoned = useRef(false);
  const latestStep = useRef(0);

  // Restore partial progress
  const partial = useRef(loadPartial());
  const isResuming = partial.current !== null && (partial.current.step ?? 0) > 0;
  const [showResumeMsg, setShowResumeMsg] = useState(isResuming);
  const [currentStep, setCurrentStep] = useState(partial.current?.step ?? 0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    partial.current?.answers ?? {},
  );
  const [chatTrigger, setChatTrigger] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  // Persist partial answers on change; also keep latestStep ref current
  useEffect(() => {
    latestStep.current = currentStep;
    savePartial({ date: todayISO(), answers, step: currentStep });
  }, [answers, currentStep]);

  // Auto-dismiss resume message after 3s
  useEffect(() => {
    if (!showResumeMsg) return;
    const id = setTimeout(() => setShowResumeMsg(false), 3000);
    return () => clearTimeout(id);
  }, [showResumeMsg]);

  // Mark as in-progress on mount; on unmount record the abandoned step if never saved
  useEffect(() => {
    abandoned.current = true;
    return () => {
      if (abandoned.current && latestStep.current > 0) {
        const raw = localStorage.getItem(PARTIAL_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as PartialState;
            localStorage.setItem(
              PARTIAL_KEY,
              JSON.stringify({ ...parsed, abandonedAtQuestion: latestStep.current }),
            );
          } catch {
            // ignore parse errors
          }
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCheckIn = useCallback(
    async (finalAnswers: Record<string, string | string[]>) => {
      setIsSaving(true);
      abandoned.current = false;
      try {
        const result = computeCheckInResult(finalAnswers);
        const elapsedSec = (Date.now() - startTime.current) / 1000;
        // Confidence heuristic: full completion in 30-180s = 1.0, outside range scales down.
        // Clamped 0.0–1.0 stored as numeric.
        const timeFactor = getTimeFactor(elapsedSec);
        const answerCount = Object.keys(finalAnswers).length;
        const completionFactor = getCompletionFactor(answerCount, steps.length);
        const confidence = Math.min(1, Math.round(timeFactor * completionFactor * 100) / 100);

        await apiRequest("POST", "/api/checkins", {
          userId,
          answers: JSON.stringify(finalAnswers),
          domainScores: JSON.stringify(result.domainScores),
          flags: result.flags.length > 0 ? result.flags : null,
          chatTriggered: chatTrigger !== null,
          confidence,
        });

        // Invalidate all relevant queries
        queryClient.invalidateQueries({ queryKey: ["/api/checkins/user", userId, "today"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scores/user", userId, "today"] });
        queryClient.invalidateQueries({ queryKey: ["/api/checkins/user", userId, "history"] });

        clearPartial();
        toast({
          title: "Check-in salvo!",
          description: "Valeu por compartilhar como você está.",
        });
        // Intentional pause so user feels the success before dashboard transitions
        await new Promise((r) => setTimeout(r, 800));
        onComplete();
      } catch (error: unknown) {
        console.error("Inline check-in save failed:", error);
        toast({
          title: "Erro",
          description: "Não foi possível salvar o check-in.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [userId, chatTrigger, toast, onComplete],
  );

  const handleAnswer = useCallback(
    (
      stepId: string,
      answer: string | string[],
      projAnswer?: ProjectionOption | null,
    ) => {
      if (isSaving) return;
      const newAnswers = { ...answers, [stepId]: answer };
      setAnswers(newAnswers);

      // Detect chat trigger
      const trigger = detectChatTrigger(stepId, answer, steps, projAnswer);
      if (trigger) {
        setChatTrigger(trigger);
        return;
      }

      if (currentStep < steps.length - 1) {
        setDirection(1);
        setCurrentStep((s) => s + 1);
      } else {
        saveCheckIn(newAnswers);
      }
    },
    [answers, currentStep, steps, saveCheckIn, isSaving],
  );

  const handleChatDismiss = useCallback(() => {
    setChatTrigger(null);
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      saveCheckIn(answers);
    }
  }, [currentStep, steps.length, answers, saveCheckIn]);

  const handleChatNavigate = useCallback(() => {
    setChatTrigger(null);
    onNavigateProtection();
  }, [onNavigateProtection]);

  return (
    <div className="glass-card rounded-2xl p-4 overflow-hidden">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1 bg-background/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {currentStep + 1}/{steps.length}
        </span>
      </div>

      {/* Gentle return message when resuming an abandoned check-in */}
      <AnimatePresence>
        {showResumeMsg && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-warmth-coral font-medium mb-3 text-center"
          >
            Que bom que voltou. Continuamos de onde parou.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Question area */}
      <AnimatePresence mode="wait" custom={direction}>
        {chatTrigger ? (
          <motion.div
            key="chat-trigger"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <InlineChatPrompt
              triggerId={chatTrigger}
              onDismiss={handleChatDismiss}
              onNavigate={handleChatNavigate}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`inline-step-${currentStep}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <InlineStepView
              step={steps[currentStep]}
              onAnswer={handleAnswer}
              previousAnswer={answers[steps[currentStep].id]}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy note — show only on first question */}
      {currentStep === 0 && !chatTrigger && (
        <p className="text-xs text-muted-foreground/80 mt-3 flex items-center gap-1.5">
          <Lock className="w-3 h-3 flex-shrink-0" />
          Respostas confidenciais — nada chega ao RH sem sua autorização.
        </p>
      )}
    </div>
  );
}

function getTimeFactor(elapsedSeconds: number): number {
  if (elapsedSeconds < 15) {
    return 0.6;
  }

  if (elapsedSeconds > 300) {
    return 0.7;
  }

  return 1;
}

function getCompletionFactor(answerCount: number, stepCount: number): number {
  if (stepCount === 0) {
    return 1;
  }

  return answerCount / stepCount;
}
