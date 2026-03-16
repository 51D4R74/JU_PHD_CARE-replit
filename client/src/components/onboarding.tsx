/**
 * Onboarding — 5-screen swipeable intro explaining the product in ≤ 60 seconds.
 *
 * Screens: Welcome → Sky & Halo → Scores → Missions → Let's go.
 * Shown on first login; skipped on subsequent sessions.
 * localStorage key: lumina_onboarded
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, ArrowRight, Sparkle, Target, Heart,
  CaretLeft, CaretRight, Cloud,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import SkyHeader from "@/components/sky-header";
import AnimatedBrandLogo from "@/components/animated-brand-logo";
import { markOnboardingComplete } from "@/lib/onboarding-state";

// Re-export for backward compatibility
export { hasCompletedOnboarding, markOnboardingComplete } from "@/lib/onboarding-state";

// ── Screen data ───────────────────────────────────

interface OnboardingScreen {
  id: string;
  title: string;
  subtitle: string;
  visual: React.ReactNode;
}

const SCREENS: OnboardingScreen[] = [
  {
    id: "welcome",
    title: "Chegou no lugar certo",
    subtitle: "Você cuida de tantos. Aqui tem um espaço só pra você — rápido, privado e sem julgamento.",
    visual: (
      <AnimatedBrandLogo size="hero" showWordmark />
    ),
  },
  {
    id: "sky-halo",
    title: "Um minuto que diz muito",
    subtitle: "Todo dia, seis perguntas rápidas criam um retrato honesto de como você está chegando — e como está saindo. O céu reflete esse estado.",
    visual: (
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <SkyHeader skyState="clear" solarHaloLevel={0.9} size="compact" />
          <p className="text-[10px] text-center text-muted-foreground">Céu aberto + halo</p>
        </div>
        <div className="flex-1 space-y-2">
          <SkyHeader skyState="protective-cloud" solarHaloLevel={0.3} size="compact" />
          <p className="text-[10px] text-center text-muted-foreground">Nuvem protetora</p>
        </div>
      </div>
    ),
  },
  {
    id: "scores",
    title: "Três dimensões, uma visão",
    subtitle: "Recarga (sono e energia), Estado do dia (humor e foco) e Clima relacional (como está com as pessoas). De 0 a 100 — sem certo ou errado.",
    visual: (
      <div className="space-y-2">
        {[
          { label: "Recarga", color: "bg-score-good", value: 78, desc: "Energia e descanso" },
          { label: "Estado do dia", color: "bg-brand-gold", value: 62, desc: "Humor e disposição" },
          { label: "Segurança relacional", color: "bg-brand-teal", value: 55, desc: "Clima interpessoal" },
        ].map((d) => (
          <div key={d.label} className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${d.color}/15 flex items-center justify-center`}>
              <span className="text-sm font-bold">{d.value}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{d.label}</p>
              <p className="text-[10px] text-muted-foreground">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "missions",
    title: "Cuidado real, no seu ritmo",
    subtitle: "Cada dia aparecem atividades feitas pro seu momento. São curtas, práticas e rendem Pontos Solares ☀️ — a Lumina que cresce com você.",
    visual: (
      <div className="space-y-2">
        {[
          { icon: <Cloud className="w-4 h-4 text-brand-teal" />, label: "Respiração quadrada", pts: 5 },
          { icon: <Heart className="w-4 h-4 text-score-attention" />, label: "Agradeça alguém", pts: 6 },
          { icon: <Target className="w-4 h-4 text-primary" />, label: "Bloco de foco de 5 min", pts: 8 },
        ].map((m) => (
          <div key={m.label} className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              {m.icon}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold">{m.label}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-brand-gold-dark font-medium">
              <Sparkle className="w-3 h-3" />
              +{m.pts}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "lets-go",
    title: "Seu céu começa agora",
    subtitle: "Menos de 1 minuto. Cada check-in clareia um pouco mais o seu dia.",
    visual: (
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sun className="w-16 h-16 text-brand-gold" />
        </motion.div>
        <p className="text-sm text-muted-foreground text-center">
          ☀️ Cada dia de cuidado clareia o céu
        </p>
      </div>
    ),
  },
];

// ── Slide animation variants ──────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -200 : 200,
    opacity: 0,
  }),
};

// ── Main component ────────────────────────────────

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const screen = SCREENS[step];
  const isLast = step === SCREENS.length - 1;
  const isFirst = step === 0;

  const goNext = useCallback(() => {
    if (isLast) {
      markOnboardingComplete();
      navigate("/dashboard");
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, SCREENS.length - 1));
  }, [isLast, navigate]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const skip = useCallback(() => {
    markOnboardingComplete();
    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="min-h-screen gradient-sunrise flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-brand-teal/5 rounded-full blur-[120px]" />
      </div>

      {/* Skip button */}
      <header className="relative z-10 px-4 pt-6 pb-2 flex justify-end max-w-lg mx-auto w-full">
        {!isLast && (
          <button
            onClick={skip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-black/5"
          >
            Pular
          </button>
        )}
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 max-w-lg mx-auto px-6 flex flex-col justify-center w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screen.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-6"
          >
            {/* Visual */}
            <div className="min-h-[180px] flex items-center justify-center">
              {screen.visual}
            </div>

            {/* Text */}
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-foreground">{screen.title}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {screen.subtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation footer */}
      <footer className="relative z-10 max-w-lg mx-auto w-full px-6 pb-8 space-y-4">
        {/* Dots indicator */}
        <div className="flex justify-center gap-2">
          {SCREENS.map((s, i) => {
            let dotClass = "stepper-dot";
            if (i === step) dotClass = "stepper-dot active";
            else if (i < step) dotClass = "stepper-dot done";
            return (
              <div
                key={s.id}
                className={dotClass}
              />
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {!isFirst && (
            <Button
              variant="outline"
              onClick={goPrev}
              className="rounded-xl px-4"
            >
              <CaretLeft className="w-4 h-4" weight="bold" />
            </Button>
          )}
          <Button
            onClick={goNext}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
          >
            {isLast ? (
              <>
                Começar meu check-in
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Próximo
                <CaretRight className="w-4 h-4 ml-2" weight="bold" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
