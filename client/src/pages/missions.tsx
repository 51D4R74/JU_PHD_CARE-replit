import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { devNow } from "@shared/dev-clock";
import { CaretLeft, ChatCircleDots } from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MissionCard, { type MissionDef, type MissionStatus } from "@/components/mission-card";
import LuminaCard from "@/components/lumina-card";
import SolarPointsBadge from "@/components/solar-points-badge";
import ConstancyDots from "@/components/constancy-dots";
import Microcheck from "@/components/microcheck";
import { type TodayScores } from "@/lib/score-engine";
import { selectMissions, POINT_VALUES } from "@/lib/mission-engine";
import { recordNeedSupport } from "@/lib/support-engine";
import type { MicroMoodId } from "@/components/one-tap-mood";
import type { UserMission, CheckInHistoryRecord } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

const EMPTY_SCORES: TodayScores = {
  domainScores: { recarga: 0, "estado-do-dia": 0, "seguranca-relacional": 0 },
  skyState: "partly-cloudy",
  solarHaloLevel: 0.5,
  flags: [],
  hasCheckedIn: false,
};

// ── Page ──────────────────────────────────────────

export default function MissionCenterPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";
  const [microcheckOpen, setMicrocheckOpen] = useState(false);
  const [microcheckCount, setMicrocheckCount] = useState(0);

  const { data: scores = EMPTY_SCORES } = useQuery<TodayScores>({
    queryKey: ["/api/scores/user", userId, "today"],
    enabled: !!userId,
  });

  const today = devNow().toISOString().slice(0, 10);

  const { data: completedMissions = [] } = useQuery<UserMission[]>({
    queryKey: ["/api/missions", userId, "today"],
    enabled: !!userId,
  });

  const { data: historyRecords = [] } = useQuery<CheckInHistoryRecord[]>({
    queryKey: ["/api/checkins/user", userId, "history"],
    enabled: !!userId,
  });

  const checkedInDates = useMemo(
    () => historyRecords.map((r) => r.date),
    [historyRecords],
  );

  const completedIds = useMemo(
    () => completedMissions.map((m) => m.missionId),
    [completedMissions],
  );

  const completeMissionMut = useMutation({
    mutationFn: async (data: { missionId: string; pointsEarned: number }) => {
      const res = await apiRequest("POST", `/api/missions/${userId}`, {
        missionId: data.missionId,
        pointsEarned: data.pointsEarned,
      });
      return res.json() as Promise<UserMission>;
    },
    onMutate: async ({ missionId, pointsEarned }) => {
      await qc.cancelQueries({ queryKey: ["/api/missions", userId, "today"] });
      const prev = qc.getQueryData<UserMission[]>(["/api/missions", userId, "today"]);
      const optimistic: UserMission = {
        id: `opt-${missionId}`,
        userId,
        missionId,
        date: today,
        pointsEarned,
        completedAt: devNow(),
      };
      qc.setQueryData<UserMission[]>(
        ["/api/missions", userId, "today"],
        (old = []) => [...old, optimistic],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(["/api/missions", userId, "today"], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/missions", userId, "today"] });
    },
  });

  // Adaptive mission selection via engine
  const missions: MissionDef[] = useMemo(() => {
    return selectMissions({
      skyState: scores.skyState,
      domainScores: scores.domainScores,
      flags: scores.flags,
      recentMissionIds: completedIds,
    });
  }, [scores.skyState, scores.domainScores, scores.flags, completedIds]);

  const totalMissions = missions.length;
  const completedCount = completedIds.filter(
    (id) => missions.some((m) => m.id === id),
  ).length;
  const progress = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  // Points: check-in + mission completions (microcheck + constancy migrated to server in S15)
  const missionPoints = completedMissions.reduce((sum, m) => sum + m.pointsEarned, 0);
  const checkinPoints = scores.hasCheckedIn ? POINT_VALUES.checkin : 0;
  const totalPoints = checkinPoints + missionPoints;

  const handleComplete = useCallback((missionId: string) => {
    if (completedIds.includes(missionId)) return;
    const mission = missions.find((m) => m.id === missionId);
    const pts = mission?.points ?? 5;
    completeMissionMut.mutate({ missionId, pointsEarned: pts });
    // Trigger microcheck after mission (max 2/day)
    if (microcheckCount < POINT_VALUES.microchecksMaxPerDay) {
      setTimeout(() => setMicrocheckOpen(true), 600);
    }
  }, [completedIds, missions, microcheckCount, completeMissionMut]);

  const handleMicrocheckRespond = useCallback(
    (mood: MicroMoodId, _context?: string) => {
      // BACKLOG: POST /api/microchecks — server microcheck API [future milestone]
      setMicrocheckCount((c) => c + 1);
      if (mood === "need-support") {
        recordNeedSupport();
        navigate("/support");
      }
    },
    [navigate],
  );

  function getStatus(missionId: string): MissionStatus {
    return completedIds.includes(missionId) ? "done" : "pending";
  }

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-gold/8 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-2 flex items-center gap-3 max-w-lg mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 -ml-2 rounded-xl hover:bg-black/5 transition-colors"
          aria-label="Voltar"
        >
          <CaretLeft className="w-5 h-5" weight="bold" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Pra Você</h1>
          <p className="text-xs text-muted-foreground">
            Pequenas ações de cuidado escolhidas pra você
          </p>
        </div>
        {/* Solar Points badge */}
        <SolarPointsBadge points={totalPoints} />
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24">
        {/* Progress bar */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 glass-card rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {completedCount}/{totalMissions} missões
            </span>
            <span className="text-xs text-muted-foreground font-medium">{progress}%</span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="progress-fill"
            />
          </div>
          {completedCount === totalMissions && totalMissions > 0 && (
            <p className="text-xs text-emerald-600 font-medium mt-2 text-center">
              🎉 Você completou tudo! Parabéns!
            </p>
          )}
        </motion.section>

        {/* Lumina companion — mission rationale */}
        <LuminaCard
          context="missions"
          compact
          delay={0.12}
          className="mt-3"
          onTap={() => navigate("/support")}
        />

        {/* Mission list */}
        <section className="mt-4 space-y-3">
          {missions.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
            >
              <MissionCard
                mission={m}
                status={getStatus(m.id)}
                onComplete={handleComplete}
              />
            </motion.div>
          ))}
        </section>

        {/* Check-in points reminder */}
        {!scores.hasCheckedIn && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-5 glass-card rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
              <ChatCircleDots className="w-5 h-5 text-brand-navy" weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Faça seu check-in</p>
              <p className="text-xs text-muted-foreground">
                Ganhe +{POINT_VALUES.checkin} ☀️ ao completar seu check-in diário
              </p>
            </div>
            <button
              onClick={() => navigate("/checkin")}
              className="text-xs font-semibold text-brand-navy px-3 py-1.5 rounded-lg bg-brand-navy/10 hover:bg-brand-navy/20 transition-colors"
            >
              Ir
            </button>
          </motion.section>
        )}

        {/* Constancy dots — last 10 days */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-5 glass-card rounded-2xl p-4"
        >
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Constância — seus últimos 10 dias
          </p>
          <ConstancyDots days={10} checkedInDates={checkedInDates} />
        </motion.section>
      </main>

      <BottomNav />

      {/* Microcheck sheet */}
      <Microcheck
        open={microcheckOpen}
        onOpenChange={setMicrocheckOpen}
        onRespond={handleMicrocheckRespond}
        variant="post-mission"
      />
    </div>
  );
}
