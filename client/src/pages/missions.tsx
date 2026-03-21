import React, { useState, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { devNow } from "@shared/dev-clock";
import { CaretLeft, ChatCircleDots, Sparkle } from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MissionMiniCard, MissionDetailDrawer, type MissionDef, type MissionStatus } from "@/components/mission-card";
import SolarPointsBadge from "@/components/solar-points-badge";
import { getTodayLumens } from "@/lib/solar-points";
import ConstancyDots from "@/components/constancy-dots";
import Microcheck from "@/components/microcheck";
import JuPHDChatCard from "@/components/juphd-chat-card";
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

export default function MissionCenterPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";
  const [microcheckOpen, setMicrocheckOpen] = useState(false);
  const [microcheckCount, setMicrocheckCount] = useState(0);
  const [selectedMission, setSelectedMission] = useState<MissionDef | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const missionPoints = completedMissions.reduce((sum, m) => sum + m.pointsEarned, 0);
  const totalPoints = getTodayLumens() + missionPoints;

  const justCompletedRef = useRef(false);

  const handleComplete = useCallback((missionId: string) => {
    if (completedIds.includes(missionId)) return;
    const mission = missions.find((m) => m.id === missionId);
    const pts = mission?.points ?? 5;
    completeMissionMut.mutate({ missionId, pointsEarned: pts });
    justCompletedRef.current = true;
  }, [completedIds, missions, completeMissionMut]);

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open && justCompletedRef.current) {
      justCompletedRef.current = false;
      if (microcheckCount < POINT_VALUES.microchecksMaxPerDay) {
        setMicrocheckOpen(true);
      }
    }
  }, [microcheckCount]);

  const handleMicrocheckRespond = useCallback(
    (mood: MicroMoodId, _context?: string) => {
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

  const handleSelectMission = useCallback((mission: MissionDef) => {
    setSelectedMission(mission);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-gold/8 rounded-full blur-[150px]" />
      </div>

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
        <SolarPointsBadge points={totalPoints} />
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24">
        {/* Slogan banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="mt-3 rounded-2xl py-2.5 px-4 text-center"
          style={{
            background: "linear-gradient(135deg, hsl(183 41% 36% / 0.10), hsl(43 82% 58% / 0.12))",
          }}
        >
          <p className="text-sm font-bold bg-gradient-to-r from-brand-teal via-brand-navy to-brand-gold bg-clip-text text-transparent">
            Você é seu melhor projeto!
          </p>
        </motion.div>

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
              Você completou tudo! Parabéns!
            </p>
          )}
        </motion.section>

        <JuPHDChatCard
          message="Pequenas ações, grande cuidado. Quer contar como está se sentindo?"
          delay={0.12}
          className="mt-3"
        />

        {/* Mission grid — 3 per row */}
        <section className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkle className="w-4 h-4 text-brand-gold" weight="fill" />
            <h2 className="text-sm font-semibold">Suas missões de hoje</h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {missions.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
              >
                <MissionMiniCard
                  mission={m}
                  status={getStatus(m.id)}
                  onSelect={handleSelectMission}
                />
              </motion.div>
            ))}
          </div>
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
          <ConstancyDots days={10} checkedInHistory={historyRecords} />
        </motion.section>
      </main>

      <BottomNav />

      {/* Mission detail drawer */}
      <MissionDetailDrawer
        mission={selectedMission}
        status={selectedMission ? getStatus(selectedMission.id) : "pending"}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        onComplete={handleComplete}
      />

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
