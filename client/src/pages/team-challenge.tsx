/**
 * TeamChallenge page — monthly collective mission with progress arc,
 * contribution flow, milestone celebrations, and collective sky.
 *
 * Individual contributions are private — only aggregate total is visible.
 * Per-person daily cap prevents gaming.
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Drop, PauseCircle, Wind, ClipboardText, Heart,
  CaretRight, CalendarDots, Trophy, Sparkle, Confetti, Target, Lock,
} from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import TeamProgressArc from "@/components/team-progress-arc";
import SkyHeader from "@/components/sky-header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCurrentChallenge,
  contributeToChallenge,
  getCollectiveSkyLevel,
  buildOfflineSnapshot,
  type ChallengeCategory,
  type TeamChallengeSnapshot,
} from "@/lib/team-challenge-engine";
import type { SkyState } from "@/lib/checkin-data";
import { useToast } from "@/hooks/use-toast";

// ── Icon map for challenge categories ─────────────

const CATEGORY_ICONS: Record<ChallengeCategory, React.ReactNode> = {
  hydration: <Drop className="w-5 h-5" weight="fill" />,
  pause: <PauseCircle className="w-5 h-5" weight="fill" />,
  support: <Heart className="w-5 h-5" weight="fill" />,
  checkin: <ClipboardText className="w-5 h-5" weight="fill" />,
  breathing: <Wind className="w-5 h-5" />,
};

// ── Collective sky state from team progress ───────

function getCollectiveSkyState(pct: number): SkyState {
  if (pct >= 75) return "clear";
  if (pct >= 50) return "partly-cloudy";
  if (pct >= 25) return "protective-cloud";
  return "respiro";
}

function contributeLabel(challenge: TeamChallengeSnapshot, canContribute: boolean): string {
  if (challenge.progressPct >= 100) return "Meta atingida! 🎉";
  if (canContribute) return `Contribuir +1 ${challenge.template.unit.slice(0, -1) || challenge.template.unit}`;
  return `Limite diário atingido (${challenge.template.capPerPersonPerDay}×)`;
}

// ── Milestone celebration overlay ─────────────────

function MilestoneCelebration({
  label,
  pct,
  onDismiss,
}: Readonly<{
  label: string;
  pct: number;
  onDismiss: () => void;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="glass-card rounded-3xl p-8 text-center max-w-xs mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.8 }}
          className="inline-flex mb-4"
        >
          {pct >= 100 ? (
            <Confetti className="w-14 h-14 text-brand-gold" weight="fill" />
          ) : (
            <Trophy className="w-14 h-14 text-brand-gold" weight="fill" />
          )}
        </motion.div>

        <h2 className="text-xl font-bold text-foreground mb-2">{label}</h2>
        <p className="text-sm text-muted-foreground mb-1">
          {pct >= 100
            ? "A equipe atingiu a meta! Juntos somos mais fortes."
            : `A equipe chegou a ${pct}% da meta. Continuem assim!`}
        </p>

        {/* Confetti-like sparkle particles */}
        <div className="relative h-8 overflow-hidden mt-2">
          {(["s0", "s1", "s2", "s3", "s4", "s5"] as const).map((id, i) => (
            <motion.div
              key={id}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${15 + i * 14}%`,
                backgroundColor: i % 2 === 0 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-teal))",
              }}
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -24, opacity: 0 }}
              transition={{
                duration: 1,
                delay: i * 0.1,
                repeat: Infinity,
                repeatDelay: 1.5,
              }}
            />
          ))}
        </div>

        <Button
          onClick={onDismiss}
          className="mt-4 bg-brand-navy hover:bg-brand-navy-hover text-white rounded-xl"
        >
          Continuar
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────

export default function TeamChallengePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [celebrationMilestone, setCelebrationMilestone] = useState<{
    label: string;
    pct: number;
  } | null>(null);

  const { data: challenge = buildOfflineSnapshot() } = useQuery<TeamChallengeSnapshot>({
    queryKey: ["/api/team-challenges/current"],
    queryFn: fetchCurrentChallenge,
  });

  const canContribute = challenge.todayCount < challenge.template.capPerPersonPerDay && challenge.progressPct < 100;
  const todayCount = challenge.todayCount;
  const skyLevel = getCollectiveSkyLevel(challenge.progressPct);
  const collectiveSkyState = getCollectiveSkyState(challenge.progressPct);

  const prevMilestonesRef = challenge.milestones;

  const contributeMutation = useMutation({
    mutationFn: () => contributeToChallenge(challenge.challengeId),
    onSuccess: async (result) => {
      if (!result.accepted) {
        toast({
          title: "Contribuição não registrada",
          description: result.reason,
          variant: "destructive",
        });
        return;
      }

      const prevReached = new Set(prevMilestonesRef.filter((m) => m.reached).map((m) => m.pct));
      await qc.invalidateQueries({ queryKey: ["/api/team-challenges/current"] });
      const updated = qc.getQueryData<TeamChallengeSnapshot>(["/api/team-challenges/current"]);
      const newMilestone = updated?.milestones.find((m) => m.reached && !prevReached.has(m.pct));

      if (newMilestone) {
        setCelebrationMilestone({ label: newMilestone.label, pct: newMilestone.pct });
      } else {
        toast({
          title: "Contribuição registrada!",
          description: `+1 ${challenge.template.unit}. Total: ${result.newTotal}/${challenge.template.target}`,
        });
      }
    },
  });

  const handleContribute = useCallback(() => {
    contributeMutation.mutate();
  }, [contributeMutation]);

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/8 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-2 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-navy flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" weight="fill" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Desafio Coletivo</p>
            <p className="text-sm font-semibold">{challenge.template.title}</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-black/5"
        >
          Voltar
        </button>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24">
        {/* Collective sky visualization */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4"
        >
          <SkyHeader
            skyState={collectiveSkyState}
            solarHaloLevel={skyLevel}
            size="hero"
          />
          <p className="text-center text-xs text-muted-foreground mt-2">
            O céu da equipe clareia conforme todos contribuem
          </p>
        </motion.section>

        {/* Progress arc */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex flex-col items-center"
        >
          <TeamProgressArc
            progressPct={challenge.progressPct}
            milestones={challenge.milestones}
            size={220}
            strokeWidth={14}
          >
            <span className="text-3xl font-bold text-foreground">
              {challenge.progressPct}%
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {challenge.progress}/{challenge.template.target} {challenge.template.unit}
            </span>
          </TeamProgressArc>
        </motion.section>

        {/* Mission info card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-5 glass-card rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
              {CATEGORY_ICONS[challenge.template.category]}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{challenge.template.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {challenge.template.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDots className="w-3.5 h-3.5" />
              <span>
                {challenge.daysRemaining === 0
                  ? "Último dia!"
                  : `${challenge.daysRemaining} dias restantes`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="w-3.5 h-3.5" />
              <span>Meta: {challenge.template.target} {challenge.template.unit}</span>
            </div>
          </div>
        </motion.section>

        {/* Contribute CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <Button
            onClick={handleContribute}
            disabled={!canContribute || contributeMutation.isPending}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base rounded-2xl border-0 glow-amber relative overflow-hidden group disabled:opacity-50"
            data-testid="button-contribute"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Sparkle className="w-5 h-5 mr-3 text-accent" weight="fill" />
            {contributeLabel(challenge, canContribute)}
            <CaretRight className="w-5 h-5 ml-3" weight="bold" />
          </Button>
          {canContribute && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Hoje: {todayCount}/{challenge.template.capPerPersonPerDay} contribuições
            </p>
          )}
        </motion.section>

        {/* Milestones */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-5 glass-card rounded-2xl p-4"
        >
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-brand-gold" weight="fill" />
            Marcos da equipe
          </h3>
          <div className="space-y-2">
            {challenge.milestones.map((m) => (
              <div
                key={m.pct}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  m.reached
                    ? "bg-score-good/10 border border-score-good/20"
                    : "bg-surface-warm/50"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    m.reached
                      ? "bg-score-good text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.reached ? "✓" : m.pct}
                </div>
                <span
                  className={`text-sm ${
                    m.reached ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Privacy notice */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-4"
        >
          <div className="privacy-note max-w-xs mx-auto">
            <Lock className="w-3 h-3 inline mr-1 opacity-60" />
            Suas contribuições individuais são privadas. Apenas o total coletivo é visível.
            Não há ranking entre participantes.
          </div>
        </motion.section>
      </main>

      <BottomNav />

      {/* Milestone celebration overlay */}
      <AnimatePresence>
        {celebrationMilestone && (
          <MilestoneCelebration
            label={celebrationMilestone.label}
            pct={celebrationMilestone.pct}
            onDismiss={() => setCelebrationMilestone(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
