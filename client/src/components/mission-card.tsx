import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";

export type MissionStatus = "pending" | "done";

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  icon: PhosphorIcon;
  points: number;
  category: string;
}

type MissionMiniCardProps = Readonly<{
  mission: MissionDef;
  status: MissionStatus;
  onSelect: (mission: MissionDef) => void;
}>;

const ENCOURAGEMENTS = [
  "Bom pra você! ☀️",
  "Pequeno gesto, grande cuidado.",
  "Isso conta mais do que parece.",
  "Você merece esse momento.",
  "Um passo de cada vez.",
  "Cuidar de si é coragem.",
] as const;

function pickEncouragement(missionId: string): string {
  let hash = 0;
  for (let i = 0; i < missionId.length; i++) {
    hash = Math.trunc((hash << 5) - hash + (missionId.codePointAt(i) ?? 0));
  }
  return ENCOURAGEMENTS[Math.abs(hash) % ENCOURAGEMENTS.length];
}

export function MissionMiniCard({ mission, status, onSelect }: MissionMiniCardProps) {
  const isDone = status === "done";
  const Icon = mission.icon;

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(mission)}
      className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition-all min-h-[100px] w-full ${
        isDone
          ? "bg-emerald-50 border border-emerald-200/60 opacity-80"
          : "glass-card hover:border-brand-teal/25 hover:shadow-sm cursor-pointer"
      }`}
      aria-label={isDone ? `${mission.title} — concluída` : mission.title}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDone ? "bg-emerald-500" : "bg-brand-navy/8"
        }`}
      >
        {isDone ? (
          <Check className="w-4.5 h-4.5 text-white" weight="bold" />
        ) : (
          <Icon className="w-4.5 h-4.5 text-brand-navy" weight="duotone" />
        )}
      </div>
      <span
        className={`text-[11px] font-medium leading-tight line-clamp-2 ${
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        }`}
      >
        {mission.title}
      </span>
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isDone
            ? "bg-emerald-100 text-emerald-700"
            : "bg-brand-gold/15 text-brand-gold-dark"
        }`}
      >
        +{mission.points} ☀️
      </span>
    </motion.button>
  );
}

type MissionDetailDrawerProps = Readonly<{
  mission: MissionDef | null;
  status: MissionStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (missionId: string) => void;
}>;

export function MissionDetailDrawer({
  mission,
  status,
  open,
  onOpenChange,
  onComplete,
}: MissionDetailDrawerProps) {
  const [celebrating, setCelebrating] = useState(false);
  const isDone = status === "done" || celebrating;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleComplete = useCallback(() => {
    if (!mission || isDone) return;
    setCelebrating(true);
    onComplete(mission.id);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCelebrating(false);
      onOpenChange(false);
      timerRef.current = null;
    }, 400);
  }, [mission, isDone, onComplete, onOpenChange]);

  if (!mission) return null;

  const Icon = mission.icon;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-lg mx-auto">
        <DrawerHeader className="text-center pt-6 pb-2">
          <div className="relative mx-auto mb-3">
            <AnimatePresence>
              {celebrating && <CelebrationBurst />}
            </AnimatePresence>
            <motion.div
              animate={celebrating ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.4 }}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                isDone ? "bg-emerald-500" : "bg-brand-navy/8"
              }`}
            >
              {isDone ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <Check className="w-7 h-7 text-white" weight="bold" />
                </motion.div>
              ) : (
                <Icon className="w-7 h-7 text-brand-navy" weight="duotone" />
              )}
            </motion.div>
          </div>
          <DrawerTitle className="text-base font-semibold">
            {mission.title}
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed mt-1">
            {mission.description}
          </DrawerDescription>
          <div className="flex justify-center mt-3">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                isDone
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-brand-gold/15 text-brand-gold-dark"
              }`}
            >
              +{mission.points} ☀️
            </span>
          </div>
        </DrawerHeader>

        <DrawerFooter className="pb-8">
          <AnimatePresence mode="wait">
            {celebrating ? (
              <motion.div
                key="celebration"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-2"
              >
                <p className="text-sm font-medium text-warmth-coral">
                  {pickEncouragement(mission.id)}
                </p>
              </motion.div>
            ) : isDone ? (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-2"
              >
                <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" weight="bold" />
                  Concluída
                </p>
              </motion.div>
            ) : (
              <motion.label
                key="cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                htmlFor={`mission-done-${mission.id}`}
                className="flex items-center gap-3 cursor-pointer rounded-2xl border border-brand-teal/15 px-4 py-3.5 transition-colors hover:bg-brand-teal/5"
              >
                <Checkbox
                  id={`mission-done-${mission.id}`}
                  checked={false}
                  onCheckedChange={handleComplete}
                  className="h-5 w-5 rounded-md border-brand-teal/40 data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
                />
                <span className="text-sm font-semibold text-foreground">
                  Marcar como feita
                </span>
              </motion.label>
            )}
          </AnimatePresence>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function CelebrationBurst() {
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * 360;
    const rad = (angle * Math.PI) / 180;
    const dist = 36 + Math.random() * 16;
    return { id: i, x: Math.cos(rad) * dist, y: Math.sin(rad) * dist };
  });

  return (
    <>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          animate={{ opacity: 0, scale: 0.2, x: p.x, y: p.y }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
          style={{
            backgroundColor: p.id % 2 === 0 ? "hsl(var(--brand-gold))" : "hsl(var(--warmth-coral))",
          }}
        />
      ))}
    </>
  );
}
