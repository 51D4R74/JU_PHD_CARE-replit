import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type MissionStatus = "pending" | "done";

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  points: number;
  category: string;
}

type MissionCardProps = Readonly<{
  mission: MissionDef;
  status: MissionStatus;
  onComplete: (missionId: string) => void;
  className?: string;
}>;

/** Tiny sparkles that burst outward on mission completion. */
function CompletionSparkles() {
  const particles = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * 360;
    const rad = (angle * Math.PI) / 180;
    const dist = 28 + Math.random() * 16;
    return { id: i, x: Math.cos(rad) * dist, y: Math.sin(rad) * dist };
  });

  return (
    <AnimatePresence>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          animate={{ opacity: 0, scale: 0.3, x: p.x, y: p.y }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: p.id % 2 === 0 ? "hsl(var(--brand-gold))" : "hsl(var(--warmth-coral))" }}
        />
      ))}
    </AnimatePresence>
  );
}
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

export default function MissionCard({
  mission,
  status,
  onComplete,
  className = "",
}: MissionCardProps) {
  const [animating, setAnimating] = useState(false);
  const isDone = status === "done" || animating;

  function handleTap() {
    if (isDone) return;
    setAnimating(true);
    // Short delay for the check animation, then notify parent
    setTimeout(() => onComplete(mission.id), 400);
  }

  const Icon = mission.icon;

  return (
    <Card
      className={`overflow-hidden transition-colors ${isDone ? "opacity-70" : "cursor-pointer hover:border-brand-navy/15"} ${className}`.trim()}
      onClick={handleTap}
      role="button"
      aria-label={isDone ? `${mission.title} — concluída` : `Completar: ${mission.title}`}
      data-testid={`mission-${mission.id}`}
    >
      <CardContent className="flex items-center gap-3 p-4">
        {/* Icon / check circle */}
        <div className="relative flex-shrink-0">
          {animating && <CompletionSparkles />}
          <motion.div
            animate={isDone ? { scale: [1, 1.2, 1], backgroundColor: "hsl(var(--score-good))" } : {}}
            transition={{ duration: 0.3 }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDone ? "bg-emerald-500" : "bg-brand-navy/10"
            }`}
          >
            {isDone ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Check className="w-5 h-5 text-white" />
              </motion.div>
            ) : (
              <Icon className="w-5 h-5 text-brand-navy" />
            )}
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {mission.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {mission.description}
          </p>
        </div>

        {/* Points badge */}
        <motion.div
          animate={isDone ? { scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.35, delay: 0.1 }}
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isDone
              ? "bg-emerald-100 text-emerald-700"
              : "bg-brand-gold/15 text-brand-gold-dark"
          }`}
        >
          +{mission.points} ☀️
        </motion.div>
      </CardContent>
      <AnimatePresence>
        {animating && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="px-4 pb-3 text-xs text-warmth-coral font-medium text-center"
          >
            {pickEncouragement(mission.id)}
          </motion.p>
        )}
      </AnimatePresence>
    </Card>
  );
}
