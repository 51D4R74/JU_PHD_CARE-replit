import { useState } from "react";
import { motion } from "framer-motion";
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

export type MicroMoodId = "ok" | "tense" | "low-energy" | "need-support";

export interface MicroMoodOption {
  id: MicroMoodId;
  label: string;
  icon: IconType;
  color: string;
  bgColor: string;
}

const MICRO_MOOD_OPTIONS: MicroMoodOption[] = [
  { id: "ok", label: "Seguindo bem", icon: TbMoodSmile, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
  { id: "tense", label: "Tenso", icon: TbMoodNervous, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
  { id: "low-energy", label: "Sem energia", icon: TbBatteryOff, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
  { id: "need-support", label: "Preciso de apoio", icon: TbHeartHandshake, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
];

type OneTapMoodProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (moodId: MicroMoodId) => void;
  /** Called when user taps "Preciso de apoio" — routes to support center. */
  onNeedSupport?: () => void;
}>;

export default function OneTapMood({ open, onOpenChange, onSelect, onNeedSupport }: OneTapMoodProps) {
  const [selectedId, setSelectedId] = useState<MicroMoodId | null>(null);

  const handleTap = (id: MicroMoodId) => {
    setSelectedId(id);
    // Brief visual feedback then close
    setTimeout(() => {
      onSelect(id);
      setSelectedId(null);
      onOpenChange(false);
      // Route "Preciso de apoio" directly to SupportCenter
      if (id === "need-support" && onNeedSupport) {
        onNeedSupport();
      }
    }, 300);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-base">Como você está agora?</SheetTitle>
          <SheetDescription className="text-xs">
            Um toque rápido. Sem perguntas extras.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3">
          {MICRO_MOOD_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedId === opt.id;

            return (
              <motion.button
                key={opt.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTap(opt.id)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-brand-navy/40 bg-brand-navy/8"
                    : "border-border/40 bg-background/40 hover:border-border"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${opt.bgColor} ring-1 ring-black/5 flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${opt.color}`} />
                </div>
                <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                  {opt.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
