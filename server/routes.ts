import type { Express, Request } from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import multer from "multer";
import type { IStorage } from "./storage";
import { requireAuth, requireOwner, requireRole } from "./middleware";
import { insertCheckInSchema, insertMomentCheckInSchema, insertUserMissionSchema, submitIncidentReportSchema, submitPulseResponseSchema, submitCommunityMessageSchema, type PulseResponse } from "@shared/schema";
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

  // ── Chat Orchestrator proxy (JuPHD Pro) ──────────────────────────────
  //
  // Connects to the Lambda-backed chat orchestrator.
  // Session continuity is maintained by passing session_id + conversationId
  // returned by the orchestrator back to the client, which re-sends them
  // on every subsequent turn.

  const CHAT_ORCHESTRATOR_URL =
    process.env.CHAT_ORCHESTRATOR_URL ||
    process.env.CHATBOT_API_URL ||
    "https://tmh2e2ojppixtgl3fcs56um74y0ilkpx.lambda-url.us-east-1.on.aws/";

  const CHATBOT_ID = "juphd-pro";
  const CLIENT_ID = "juphd-care";

  app.post("/api/chat", requireAuth, async (req, res) => {
    const { message, sessionId, conversationId, dbConversationId } = req.body as {
      message: unknown;
      sessionId?: string;
      conversationId?: string;
      dbConversationId?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0 || message.length > 2000) {
      return res.status(400).json({ message: "Mensagem inválida" });
    }

    const userId = req.userId!;

    try {
      const payload: Record<string, unknown> = {
        query: `query: ${message.trim()}`,
        userId,
        clientId: CLIENT_ID,
        chatbotId: CHATBOT_ID,
      };
      if (sessionId) payload.session_id = sessionId;
      if (conversationId) payload.conversationId = conversationId;

      const response = await fetch(CHAT_ORCHESTRATOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Chat orchestrator error:", response.status, errText);
        return res.status(502).json({ message: "Serviço de IA temporariamente indisponível" });
      }

      const data = await response.json() as {
        status?: string;
        response?: string;
        session_id?: string;
        conversation_id?: string;
      };

      const replyText = data.response ?? "Desculpe, não consegui processar sua mensagem.";
      const orchSessionId = data.session_id ?? null;
      const orchConversationId = data.conversation_id ?? null;

      let convId = dbConversationId ?? null;
      try {
        if (convId) {
          const existingConv = await storage.getChatConversation(convId);
          if (!existingConv || existingConv.userId !== userId) {
            convId = null;
          }
        }

        if (!convId) {
          const conv = await storage.createChatConversation({
            userId,
            title: message.trim().slice(0, 80),
            orchestratorSessionId: orchSessionId,
            orchestratorConversationId: orchConversationId,
          });
          convId = conv.id;
        } else {
          if (orchSessionId || orchConversationId) {
            await storage.updateChatConversation(convId, {
              orchestratorSessionId: orchSessionId ?? undefined,
              orchestratorConversationId: orchConversationId ?? undefined,
            });
          }
        }
        await storage.createChatMessage({ conversationId: convId, role: "user", content: message.trim() });
        await storage.createChatMessage({ conversationId: convId, role: "assistant", content: replyText });
      } catch (e: unknown) {
        console.error("Chat persistence error (non-fatal):", e);
      }

      return res.json({
        reply: replyText,
        session_id: orchSessionId,
        conversation_id: orchConversationId,
        db_conversation_id: convId,
      });
    } catch (e: unknown) {
      console.error("Chat orchestrator proxy error:", e);
      return res.status(502).json({ message: "Serviço de IA temporariamente indisponível" });
    }
  });

  app.get("/api/chat/conversations", requireAuth, async (req, res) => {
    const userId = req.userId!;
    const conversations = await storage.getChatConversationsByUserId(userId);
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const msgs = await storage.getChatMessagesByConversationId(conv.id);
        const firstBotMsg = msgs.find((m) => m.role === "assistant");
        return {
          id: conv.id,
          title: conv.title,
          preview: firstBotMsg?.content?.slice(0, 120) ?? null,
          messageCount: msgs.length,
          orchestratorSessionId: conv.orchestratorSessionId,
          orchestratorConversationId: conv.orchestratorConversationId,
          createdAt: conv.createdAt?.toISOString() ?? null,
          updatedAt: conv.updatedAt?.toISOString() ?? null,
        };
      }),
    );
    return res.json(result);
  });

  app.get("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
    const convId = param(req, "id");
    const conv = await storage.getChatConversation(convId);
    if (!conv) return res.status(404).json({ message: "Conversa não encontrada" });
    if (conv.userId !== req.userId) return res.status(403).json({ message: "Acesso não autorizado" });
    const msgs = await storage.getChatMessagesByConversationId(convId);
    return res.json({
      conversation: {
        id: conv.id,
        title: conv.title,
        orchestratorSessionId: conv.orchestratorSessionId,
        orchestratorConversationId: conv.orchestratorConversationId,
      },
      messages: msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt?.toISOString() ?? null,
      })),
    });
  });

  app.post("/api/chat/close", requireAuth, async (req, res) => {
    const { sessionId, conversationId } = req.body as {
      sessionId?: string;
      conversationId?: string;
    };

    if (!sessionId && !conversationId) {
      return res.json({ closed: true });
    }

    try {
      const payload: Record<string, unknown> = {
        closeSession: true,
        userId: req.userId ?? "anonymous",
        clientId: CLIENT_ID,
        chatbotId: CHATBOT_ID,
      };
      if (sessionId) payload.session_id = sessionId;
      if (conversationId) payload.conversationId = conversationId;

      await fetch(CHAT_ORCHESTRATOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e: unknown) {
      console.error("Chat close session error:", e);
    }

    return res.json({ closed: true });
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

  // ── Community messages ───────────────────────────────────────────────

  app.get("/api/community-messages", requireAuth, async (req, res) => {
    const limitParam = req.query.limit;
    const pageParam = req.query.page;
    const limit = typeof limitParam === "string" ? Math.min(50, Math.max(1, Number.parseInt(limitParam, 10) || 10)) : 10;
    const page = typeof pageParam === "string" ? Math.max(1, Number.parseInt(pageParam, 10) || 1) : 1;
    const offset = (page - 1) * limit;

    const messages = await storage.getCommunityMessages(limit, offset);
    const userId = req.userId!;
    const likedIds = await storage.getUserLikedMessageIds(userId);
    const likedSet = new Set(likedIds);

    const result = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      audioUrl: msg.audioUrl,
      mediaType: msg.mediaType,
      authorName: msg.isAnonymous ? null : msg.authorName,
      isAnonymous: msg.isAnonymous,
      category: msg.category,
      likeCount: msg.likeCount,
      likedByMe: likedSet.has(msg.id),
      createdAt: msg.createdAt?.toISOString() ?? null,
    }));

    return res.json(result);
  });

  const uploadsDir = path.resolve("uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const audioUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".webm";
        cb(null, `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("audio/")) cb(null, true);
      else cb(new Error("Apenas arquivos de áudio são permitidos"));
    },
  });

  app.post("/api/upload-audio", requireAuth, audioUpload.single("audio"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
    const audioUrl = `/uploads/${req.file.filename}`;
    return res.json({ audioUrl });
  });

  app.post("/api/community-messages", requireAuth, async (req, res) => {
    try {
      const data = submitCommunityMessageSchema.parse(req.body);
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      const fullName = user?.name ?? null;
      const firstName = fullName ? fullName.split(" ")[0] : null;
      const authorName = data.isAnonymous ? null : firstName;

      const msg = await storage.createCommunityMessage({
        userId,
        content: data.content ?? null,
        audioUrl: data.audioUrl ?? null,
        mediaType: data.mediaType,
        isAnonymous: data.isAnonymous,
        authorName,
        category: data.category ?? null,
      });

      return res.json({
        id: msg.id,
        content: msg.content,
        audioUrl: msg.audioUrl,
        mediaType: msg.mediaType,
        authorName: msg.isAnonymous ? null : msg.authorName,
        isAnonymous: msg.isAnonymous,
        category: msg.category,
        likeCount: msg.likeCount,
        likedByMe: false,
        createdAt: msg.createdAt?.toISOString() ?? null,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Dados inválidos";
      return res.status(400).json({ message });
    }
  });

  app.post("/api/community-messages/:id/like", requireAuth, async (req, res) => {
    const messageId = param(req, "id");
    const userId = req.userId!;
    try {
      const result = await storage.toggleMessageLike(messageId, userId);
      return res.json(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao curtir";
      return res.status(400).json({ message });
    }
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
