/**
 * Microcheck — lightweight follow-up after mission completion or distress signal.
 *
 * Displays as a bottom sheet with 1 question + dismiss.
 * Max 2 microchecks per day (enforced by caller).
 * Records response via saveMicroMood in score-engine.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbMoodSmile,
  TbMoodNervous,
  TbBatteryOff,
  TbHeartHandshake,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { MicroMoodId } from "@/components/one-tap-mood";

interface MicrocheckProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRespond: (mood: MicroMoodId, context?: string) => void;
  /** Contextual prompt — e.g. after mission vs after distress. */
  readonly variant?: "post-mission" | "post-distress";
}

interface FollowUpOption {
  id: string;
  label: string;
}

const FOLLOW_UP_OPTIONS: FollowUpOption[] = [
  { id: "workload", label: "Carga de trabalho" },
  { id: "relationships", label: "Relações no trabalho" },
  { id: "personal", label: "Algo pessoal" },
  { id: "undefined", label: "Não sei bem" },
];

const MOOD_OPTIONS: { id: MicroMoodId; label: string; icon: IconType; color: string }[] = [
  { id: "ok", label: "Melhor", icon: TbMoodSmile, color: "text-score-good" },
  { id: "tense", label: "Tenso", icon: TbMoodNervous, color: "text-score-attention" },
  { id: "low-energy", label: "Cansado", icon: TbBatteryOff, color: "text-score-moderate" },
  { id: "need-support", label: "Preciso de apoio", icon: TbHeartHandshake, color: "text-score-critical" },
];

export default function Microcheck({
  open,
  onOpenChange,
  onRespond,
  variant = "post-mission",
}: MicrocheckProps) {
  const [selectedMood, setSelectedMood] = useState<MicroMoodId | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const title =
    variant === "post-mission"
      ? "Como você está agora?"
      : "O que pesa mais agora?";

  const subtitle =
    variant === "post-mission"
      ? "Um toque rápido após a missão."
      : "Só uma pergunta. Sem julgamento.";

  function handleMoodTap(mood: MicroMoodId) {
    setSelectedMood(mood);
    // Show follow-up for tense/low-energy/need-support
    if (mood === "ok") {
      setTimeout(() => {
        onRespond(mood);
        reset();
      }, 250);
    } else {
      setShowFollowUp(true);
    }
  }

  function handleFollowUp(context: string) {
    if (!selectedMood) return;
    onRespond(selectedMood, context);
    reset();
  }

  function handleDismiss() {
    reset();
    onOpenChange(false);
  }

  function reset() {
    setSelectedMood(null);
    setShowFollowUp(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <SheetDescription className="text-xs">{subtitle}</SheetDescription>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {showFollowUp ? (
            <motion.div
              key="followup"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <p className="text-sm font-medium mb-3">O que pesa mais agora?</p>
              {FOLLOW_UP_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleFollowUp(opt.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border/40 bg-background/40 hover:border-border text-sm transition-all"
                >
                  {opt.label}
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="mood"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -16 }}
              className="grid grid-cols-2 gap-3"
            >
              {MOOD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = selectedMood === opt.id;

                return (
                  <motion.button
                    key={opt.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleMoodTap(opt.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 transition-all ${
                      isActive
                        ? "border-brand-navy/40 bg-brand-navy/8"
                        : "border-border/40 bg-background/40 hover:border-border"
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${opt.color}`} />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Pular
        </button>
      </SheetContent>
    </Sheet>
  );
}
