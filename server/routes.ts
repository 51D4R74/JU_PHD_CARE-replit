import type { Express, Request } from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import type { IStorage } from "./storage";
import { requireAuth, requireOwner, requireRole } from "./middleware";
import { insertCheckInSchema, insertMomentCheckInSchema, insertUserMissionSchema, submitIncidentReportSchema, submitPulseResponseSchema, type PulseResponse } from "@shared/schema";
import { getWorkday, getWorkdayDate, POINT_VALUES } from "@shared/constants";
import { selectMonthlyChallenge, getMonthBounds } from "@shared/challenges";
import { buildCurrentPulseState, getPulseDefinitionByKey, hasCompletePulseAnswerSet, parsePulseScoreSummary, scorePulseAnswers, toPulseAnswerRecord, type LatestPulseSnapshot } from "@shared/pulse-survey";
import { devNow, devAdvanceMs, devResetClock, getDevClockSnapshot } from "@shared/dev-clock";

/** Type-safe extraction of a single route param (Express 5 returns string | string[]). */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

function mapPulseResponse(record: PulseResponse): LatestPulseSnapshot | null {
  const scoreSummary = parsePulseScoreSummary(record.scoreSummary);
  if (scoreSummary === null || !(record.submittedAt instanceof Date)) {
    return null;
  }

  return {
    id: record.id,
    pulseKey: record.pulseKey,
    pulseVersion: record.pulseVersion,
    submittedAt: record.submittedAt.toISOString(),
    windowStart: record.windowStart,
    windowEnd: record.windowEnd,
    scoreSummary,
  };
}

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 20, // max 20 attempts per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Espere alguns minutos e tente de novo." },
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  storage: IStorage,
): Promise<Server> {
  // ── Kill stale dev SW (self-destruct response) ───────────────────────
  app.get("/dev-sw.js", (_req, res) => {
    res.type("application/javascript").send("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',()=>{self.registration.unregister();self.clients.matchAll().then(cs=>cs.forEach(c=>c.navigate(c.url)));});");
  });

  // ── Auth (public, rate-limited) ──────────────────────────────────────

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || typeof username !== "string" || !password || typeof password !== "string") {
      return res.status(400).json({ message: "Preencha email e senha" });
    }
    if (username.length > 254 || password.length > 128) {
      return res.status(400).json({ message: "Credenciais inválidas" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user) {
      // Constant-time comparison even when user not found to prevent timing attacks
      await bcrypt.compare(password, "$2b$10$invalidhashtopreventtimingattac");
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    // Establish server session
    req.session.userId = user.id;
    req.session.userRole = user.role;
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { username, password, name, department } = req.body;
    if (!username || typeof username !== "string" || !password || typeof password !== "string" || !name || typeof name !== "string") {
      return res.status(400).json({ message: "Preencha nome, email e senha" });
    }
    if (username.length > 254 || password.length > 128 || name.length > 100) {
      return res.status(400).json({ message: "Dados inválidos" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      return res.status(400).json({ message: "Email inválido" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "A senha precisa ter pelo menos 8 caracteres" });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "Esse email já está cadastrado" });
    }
    const user = await storage.createUser({
      username,
      password,
      name,
      role: "collaborator",
      department: department || null,
    });
    // Establish server session
    req.session.userId = user.id;
    req.session.userRole = user.role;
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("lumina.sid");
      res.clearCookie("juphd.sid");
      return res.json({ message: "Sessão encerrada. Até logo!" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Você precisa estar logado" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      res.clearCookie("lumina.sid");
      return res.status(401).json({ message: "Usuário não encontrado" });
    }
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  // ── User routes (authenticated + owner) ──────────────────────────────

  app.get("/api/users/:id", requireAuth, requireOwner("id"), async (req, res) => {
    const id = param(req, "id");
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.get("/api/users/:id/settings", requireAuth, requireOwner("id"), async (req, res) => {
    const id = param(req, "id");
    const settings = await storage.getUserSettings(id);
    if (!settings) return res.status(404).json({ message: "Configurações não encontradas" });
    return res.json(settings);
  });

  app.patch("/api/users/:id/settings", requireAuth, requireOwner("id"), async (req, res) => {
    const id = param(req, "id");
    const body = req.body as { settings?: unknown };
    if (typeof body.settings !== "string" || body.settings.length > 10_000) {
      return res.status(400).json({ message: "Dados inválidos" });
    }
    try {
      JSON.parse(body.settings);
    } catch (e: unknown) {
      console.warn("Invalid settings JSON:", e);
      return res.status(400).json({ message: "Configurações inválidas" });
    }
    const result = await storage.upsertUserSettings(id, body.settings);
    return res.json(result);
  });

  // ── Check-ins (authenticated + owner) ────────────────────────────────

  app.post("/api/checkins", requireAuth, async (req, res) => {
    try {
      const data = insertCheckInSchema.parse(req.body);
      // Enforce: userId in body must match session user
      if (data.userId !== req.userId) {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }
      const checkIn = await storage.createCheckIn(data);
      return res.json(checkIn);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Dados inválidos";
      return res.status(400).json({ message });
    }
  });

  app.get("/api/checkins/user/:userId", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const checkIns = await storage.getCheckInsByUserId(userId);
    return res.json(checkIns);
  });

  app.get("/api/checkins/user/:userId/today", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const checkIns = await storage.getCheckInsByUserIdAndDate(userId, getWorkdayDate(devNow()));
    return res.json(checkIns);
  });

  app.get("/api/checkins/user/:userId/history", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const daysParam = req.query.days;
    const days = typeof daysParam === "string" && daysParam !== "all"
      ? Number.parseInt(daysParam, 10) || null
      : null;
    const history = await storage.getHistoryByUserId(userId, days);
    return res.json(history);
  });

  app.get("/api/checkins", requireAuth, requireRole("rh"), async (_req, res) => {
    const checkIns = await storage.getAllCheckIns();
    return res.json(checkIns);
  });

  // ── Formal pulses (authenticated + owner) ───────────────────────────

  app.get("/api/pulses/user/:userId/current", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const latestRecord = await storage.getLatestPulseResponseByUserId(userId, "relational-monthly");
    const latestResponse = latestRecord ? mapPulseResponse(latestRecord) : null;
    return res.json(buildCurrentPulseState(latestResponse));
  });

  app.get("/api/pulses/user/:userId/history", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const history = await storage.getPulseResponsesByUserId(userId, "relational-monthly");
    return res.json(history.map(mapPulseResponse).filter((entry): entry is LatestPulseSnapshot => entry !== null));
  });

  app.post("/api/pulses", requireAuth, async (req, res) => {
    try {
      const data = submitPulseResponseSchema.parse(req.body);
      if (data.userId !== req.userId) {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }

      const definition = getPulseDefinitionByKey(data.pulseKey);
      if (data.pulseVersion !== definition?.version) {
        return res.status(400).json({ message: "Pulse inválido ou desatualizado" });
      }

      if (!hasCompletePulseAnswerSet(definition, data.answers)) {
        return res.status(400).json({ message: "Responda todos os itens antes de enviar" });
      }

      const latestRecord = await storage.getLatestPulseResponseByUserId(data.userId, data.pulseKey);
      const latestResponse = latestRecord ? mapPulseResponse(latestRecord) : null;
      const currentState = buildCurrentPulseState(latestResponse);

      if (!currentState.isDue) {
        return res.status(409).json({ message: "Você já respondeu esse pulse neste ciclo" });
      }

      if (data.windowStart !== currentState.window.windowStart || data.windowEnd !== currentState.window.windowEnd) {
        return res.status(409).json({ message: "A janela do pulse mudou. Atualize a tela e tente de novo." });
      }

      const answerRecord = toPulseAnswerRecord(data.answers);
      const scoreSummary = scorePulseAnswers(definition, answerRecord);
      const response = await storage.createPulseResponse({
        userId: data.userId,
        pulseKey: data.pulseKey,
        pulseVersion: data.pulseVersion,
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        answers: JSON.stringify(answerRecord),
        scoreSummary: JSON.stringify(scoreSummary),
      });

      await storage.createSolarPointEntry({
        userId: data.userId,
        action: `pulse:${data.pulseKey}`,
        points: POINT_VALUES.pulseSurvey,
        date: getWorkday(devNow()),
      });

      return res.json({
        id: response.id,
        submittedAt: response.submittedAt,
        scoreSummary,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Dados inválidos";
      return res.status(400).json({ message });
    }
  });

  // ── Scores (authenticated + owner, except RH aggregate) ─────────────

  app.get("/api/scores/user/:userId/today", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const scores = await storage.getTodayScoresByUserId(userId);
    return res.json(scores);
  });

  app.get("/api/rh/aggregate", requireAuth, requireRole("rh"), async (_req, res) => {
    const aggregate = await storage.getRhAggregate();
    return res.json(aggregate);
  });

  // ── Missions (authenticated + owner) ─────────────────────────────────

  app.get("/api/missions/:userId/today", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const isoDate = getWorkday(devNow());
    const missions = await storage.getDailyMissions(userId, isoDate);
    return res.json(missions);
  });

  app.post("/api/missions/:userId", requireAuth, requireOwner(), async (req, res) => {
    try {
      const userId = param(req, "userId");
      const body = insertUserMissionSchema.omit({ userId: true, date: true }).parse(req.body);
      const mission = await storage.completeMission({
        userId,
        date: getWorkday(devNow()),
        ...body,
      });
      return res.json(mission);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Dados inválidos";
      return res.status(400).json({ message });
    }
  });

  // ── Legacy moment check-ins (authenticated + owner) ──────────────────

  app.post("/api/moment-checkins", requireAuth, async (req, res) => {
    try {
      const data = insertMomentCheckInSchema.parse(req.body);
      if (data.userId !== req.userId) {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }
      const checkIn = await storage.createMomentCheckIn(data);
      return res.json(checkIn);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Dados inválidos";
      return res.status(400).json({ message });
    }
  });

  app.get("/api/moment-checkins/user/:userId", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const checkIns = await storage.getMomentCheckInsByUserId(userId);
    return res.json(checkIns);
  });

  app.get("/api/moment-checkins/user/:userId/today", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const checkIns = await storage.getMomentCheckInsByUserIdAndDate(userId, getWorkdayDate(devNow()));
    return res.json(checkIns);
  });

  app.get("/api/moment-checkins", requireAuth, requireRole("rh"), async (_req, res) => {
    const checkIns = await storage.getAllMomentCheckIns();
    return res.json(checkIns);
  });

  // ── Incidents (authenticated, creation owner-enforced, list RH-only) ─

  app.post("/api/incidents", requireAuth, async (req, res) => {
    try {
      const data = submitIncidentReportSchema.parse(req.body);
      // Allow anonymous (userId can be null) but if set, must match session
      if (data.userId && data.userId !== req.userId) {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }
      const report = await storage.createIncidentReport(data);
      return res.json(report);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Dados inválidos";
      return res.status(400).json({ message });
    }
  });

  app.get("/api/incidents", requireAuth, requireRole("rh"), async (_req, res) => {
    const reports = await storage.getAllIncidentReports();
    return res.json(reports);
  });

  // ── Solar points ─────────────────────────────────────────────────────

  app.post("/api/solar/award", requireAuth, async (req, res) => {
    const { action, points } = req.body;
    if (!action || typeof action !== "string" || typeof points !== "number") {
      return res.status(400).json({ message: "Ação e pontos são necessários" });
    }
    const userId = req.userId!;
    const date = getWorkday(devNow());
    const entry = await storage.createSolarPointEntry({ userId, action, points, date });
    return res.json(entry);
  });

  app.get("/api/solar/status/:userId", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const entries = await storage.getSolarPointsByUserId(userId);
    const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);
    return res.json({ totalPoints, entries });
  });

  // ── Sky state (convenience — client computes, server stores) ─────────

  app.get("/api/sky/current/:userId", requireAuth, requireOwner(), async (req, res) => {
    const userId = param(req, "userId");
    const todayCheckIns = await storage.getCheckInsByUserIdAndDate(userId, getWorkdayDate(devNow()));
    if (todayCheckIns.length === 0) {
      return res.json({ skyState: null, message: "Nenhum check-in hoje" });
    }
    const latest = todayCheckIns.at(-1)!;
    const domainScores = JSON.parse(latest.domainScores);
    return res.json({ domainScores, skyState: null }); // skyState derived client-side
  });

  // ── LGPD data export / deletion (PRD v2.0 S12.3) ────────────────────

  app.get("/api/my-data", requireAuth, async (req, res) => {
    const userId = req.userId!;
    const [user, checkIns, missions, settings] = await Promise.all([
      storage.getUser(userId),
      storage.getCheckInsByUserId(userId),
      storage.getDailyMissions(userId, "all"),
      storage.getUserSettings(userId),
    ]);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    const { password: _, ...safeUser } = user;
    return res.json({ user: safeUser, checkIns, missions, settings });
  });

  app.delete("/api/my-data", requireAuth, async (req, res) => {
    const userId = req.userId!;
    await storage.deleteUserData(userId);
    req.session.destroy(() => {
      res.clearCookie("juphd.sid");
    });
    return res.json({ message: "Seus dados foram removidos com sucesso" });
  });

  // ── Support escalation (PRD v2.0 S8) ────────────────────────────────

  app.post("/api/support/escalate", requireAuth, async (req, res) => {
    const { level } = req.body;
    if (typeof level !== "number" || level < 1 || level > 3) {
      return res.status(400).json({ message: "Nível de escalação inválido" });
    }
    // Level 3 = org escalation: create an anonymized incident report
    if (level === 3) {
      await storage.createIncidentReport({
        userId: null, // anonymous
        category: "escalation",
        subcategory: "stepped_care_level_3",
        description: "Escalação automática de cuidado progressivo — nível 3",
        anonymous: true,
      });
    }
    return res.json({ level, message: "Escalação registrada" });
  });

  // ── Chatbot proxy (PRD v2.0 — RAG endpoint) ─────────────────────────

  const CHATBOT_API_URL = process.env.CHATBOT_API_URL || "";

  app.post("/api/chat", requireAuth, async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.length > 2000) {
      return res.status(400).json({ message: "Mensagem inválida" });
    }

    // If RAG chatbot is configured, proxy the request
    if (CHATBOT_API_URL) {
      try {
        const response = await fetch(CHATBOT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, userId: req.userId }),
        });
        if (!response.ok) {
          return res.status(502).json({ message: "Serviço de IA temporariamente indisponível" });
        }
        const data = await response.json();
        return res.json(data);
      } catch (e: unknown) {
        console.error("Chatbot proxy error:", e);
        return res.status(502).json({ message: "Serviço de IA temporariamente indisponível" });
      }
    }

    // Fallback: no RAG configured, return a static supportive response
    return res.json({
      reply: "Estou aqui para ajudar. No momento, o serviço de IA está sendo configurado. Se precisar de apoio imediato, ligue para o CVV: 188.",
      source: "fallback",
    });
  });

  // ── Team challenges ──────────────────────────────────────────────────

  app.get("/api/team-challenges/current", requireAuth, async (req, res) => {
    const template = selectMonthlyChallenge();
    const bounds = getMonthBounds();
    const contributions = await storage.getTeamContributionsByChallengeAndMonth(
      template.id,
      bounds.start,
      bounds.end,
    );
    const progress = contributions.reduce((sum, c) => sum + c.amount, 0);

    const userId = req.userId!;
    const today = getWorkday(devNow());
    const todayContribs = await storage.getUserTodayTeamContributions(userId, template.id, today);
    const todayCount = todayContribs.reduce((sum, c) => sum + c.amount, 0);

    const now = devNow();
    const endDate = new Date(bounds.end + "T23:59:59");
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));
    const progressPct = Math.min(100, Math.round((progress / template.target) * 100));

    return res.json({
      challengeId: template.id,
      template,
      startDate: bounds.start,
      endDate: bounds.end,
      progress,
      progressPct,
      daysRemaining,
      todayCount,
    });
  });

  app.post("/api/team-challenges/:challengeId/contribute", requireAuth, async (req, res) => {
    const challengeId = param(req, "challengeId");
    const template = selectMonthlyChallenge();

    // Only accept contributions for the current month's challenge
    if (challengeId !== template.id) {
      return res.status(409).json({
        accepted: false,
        reason: "Desafio não corresponde ao mês atual",
        newTotal: 0,
      });
    }

    const bounds = getMonthBounds();
    const userId = req.userId!;
    const today = getWorkday(devNow());

    // Check daily cap
    const todayContribs = await storage.getUserTodayTeamContributions(userId, challengeId, today);
    const todayCount = todayContribs.reduce((sum, c) => sum + c.amount, 0);
    if (todayCount >= template.capPerPersonPerDay) {
      const contributions = await storage.getTeamContributionsByChallengeAndMonth(challengeId, bounds.start, bounds.end);
      const newTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
      return res.json({
        accepted: false,
        reason: `Limite diário atingido (${template.capPerPersonPerDay} ${template.unit}/dia)`,
        newTotal,
      });
    }

    // Check if target already reached
    const currentContribs = await storage.getTeamContributionsByChallengeAndMonth(challengeId, bounds.start, bounds.end);
    const currentProgress = currentContribs.reduce((sum, c) => sum + c.amount, 0);
    if (currentProgress >= template.target) {
      return res.json({ accepted: false, reason: "Meta já atingida! 🎉", newTotal: currentProgress });
    }

    await storage.createTeamContribution({ userId, challengeId, amount: 1, date: today });
    const newTotal = currentProgress + 1;
    return res.json({ accepted: true, newTotal });
  });

  // ── Baseline status ──────────────────────────────────────────────────

  app.get("/api/users/:id/baseline-status", requireAuth, requireOwner("id"), async (req, res) => {
    const id = param(req, "id");
    const history = await storage.getHistoryByUserId(id, null);
    const checkInCount = history.length;
    return res.json({ baselineReady: checkInCount >= 15, checkInCount });
  });

  // ── Dev-only: clock simulation + reset ────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/clock", (_req, res) => {
      return res.json(getDevClockSnapshot());
    });

    app.post("/api/dev/clock", (req, res) => {
      const { action } = req.body;
      const HOUR = 3_600_000;
      if (action === "advance1h") {
        devAdvanceMs(HOUR);
      } else if (action === "advance6h") {
        devAdvanceMs(6 * HOUR);
      } else if (action === "advance1d") {
        devAdvanceMs(24 * HOUR);
      } else {
        return res.status(400).json({ message: "Ação inválida." });
      }
      return res.json(getDevClockSnapshot());
    });

    app.post("/api/dev/reset", requireAuth, async (req, res) => {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Não autenticado." });
      }
      devResetClock();
      await storage.resetUserActivity(userId);
      return res.json({ ...getDevClockSnapshot(), message: "Clock e dados resetados." });
    });
  }

  return httpServer;
}
