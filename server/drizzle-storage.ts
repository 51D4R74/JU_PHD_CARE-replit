import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { ANONYMITY_THRESHOLD, PULSE_SURVEY_INTERVAL_DAYS } from "@shared/constants";
import { parsePulseScoreSummary, type PulseDimension } from "@shared/pulse-survey";
import {
  tenantPlans,
  tenants,
  tenantMemberships,
  billingPeriods,
  users,
  checkIns,
  momentCheckIns,
  incidentReports,
  userMissions,
  userSettings,
  solarPoints,
  solarStreaks,
  pulseResponses,
  teamChallengeContributions,
  communityMessages,
  messageLikes,
  chatConversations,
  chatMessages,
  getDefaultTenantCapabilities,
} from "@shared/schema";
import type {
  TenantPlan,
  InsertTenantPlan,
  UpdateTenantPlan,
  Tenant,
  InsertTenant,
  UpdateTenant,
  TenantMembership,
  CreateTenantMembership,
  UpdateTenantMembership,
  TenantCapability,
  BillingPeriod,
  CreateBillingPeriod,
  UpdateBillingPeriodUsage,
  User,
  InsertUser,
  CheckIn,
  InsertCheckIn,
  MomentCheckIn,
  InsertMomentCheckIn,
  IncidentReport,
  InsertIncidentReport,
  UserMission,
  InsertUserMission,
  UserSettings,
  SolarPoints,
  InsertSolarPoints,
  PulseResponse,
  InsertPulseResponse,
  RhPulseAggregate,
  RhPulseDimensionScores,
  TeamChallengeContribution,
  InsertTeamChallengeContribution,
  CommunityMessage,
  InsertCommunityMessage,
  ChatConversation,
  InsertChatConversation,
  ChatMessage as ChatMessageType,
  InsertChatMessage,
} from "@shared/schema";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { BaseStorage } from "./storage";
import { getDb } from "./db";

export class DrizzleStorage extends BaseStorage {
  async getAllTenantPlans(): Promise<TenantPlan[]> {
    return getDb().select().from(tenantPlans).orderBy(tenantPlans.name);
  }

  async getTenantPlan(id: string): Promise<TenantPlan | undefined> {
    const rows = await getDb().select().from(tenantPlans).where(eq(tenantPlans.id, id)).limit(1);
    return rows.at(0);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return getDb().select().from(tenants).orderBy(tenants.name);
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const rows = await getDb().select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return rows.at(0);
  }

  async getAllTenantMemberships(): Promise<TenantMembership[]> {
    return getDb().select().from(tenantMemberships).orderBy(tenantMemberships.tenantId, tenantMemberships.userId);
  }

  async getTenantMembershipsByUserId(userId: string): Promise<TenantMembership[]> {
    return getDb()
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.userId, userId))
      .orderBy(tenantMemberships.tenantId);
  }

  async createTenantPlan(insertPlan: InsertTenantPlan): Promise<TenantPlan> {
    const rows = await getDb()
      .insert(tenantPlans)
      .values({
        id: randomUUID(),
        code: insertPlan.code,
        name: insertPlan.name,
        audience: insertPlan.audience,
        description: insertPlan.description,
        isolationProfile: insertPlan.isolationProfile,
        monthlyActiveUserLimit: insertPlan.monthlyActiveUserLimit ?? null,
        active: insertPlan.active ?? true,
      })
      .returning();
    const plan = rows.at(0);
    if (!plan) throw new Error("Falha ao criar plano de tenant");
    return plan;
  }

  async updateTenantPlan(id: string, updates: UpdateTenantPlan): Promise<TenantPlan | undefined> {
    const rows = await getDb()
      .update(tenantPlans)
      .set(updates)
      .where(eq(tenantPlans.id, id))
      .returning();
    return rows.at(0);
  }

  async getTenantBillingPeriods(tenantId: string): Promise<BillingPeriod[]> {
    return getDb()
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.tenantId, tenantId))
      .orderBy(desc(billingPeriods.periodStart));
  }

  async getActiveBillingPeriod(tenantId: string): Promise<BillingPeriod | undefined> {
    const rows = await getDb()
      .select()
      .from(billingPeriods)
      .where(and(eq(billingPeriods.tenantId, tenantId), eq(billingPeriods.status, "active")))
      .limit(1);
    return rows.at(0);
  }

  async createBillingPeriod(data: CreateBillingPeriod): Promise<BillingPeriod> {
    const now = new Date();
    const rows = await getDb()
      .insert(billingPeriods)
      .values({
        id: randomUUID(),
        tenantId: data.tenantId,
        planCode: data.planCode,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        mauLimit: data.mauLimit ?? null,
        mauUsed: 0,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const period = rows.at(0);
    if (!period) throw new Error("Falha ao criar período de cobrança");
    return period;
  }

  async updateBillingPeriodUsage(id: string, updates: UpdateBillingPeriodUsage): Promise<BillingPeriod | undefined> {
    const rows = await getDb()
      .update(billingPeriods)
      .set({ mauUsed: updates.mauUsed, status: updates.status, updatedAt: new Date() })
      .where(eq(billingPeriods.id, id))
      .returning();
    return rows.at(0);
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const now = new Date();
    const rows = await getDb()
      .insert(tenants)
      .values({
        id: randomUUID(),
        slug: insertTenant.slug,
        name: insertTenant.name,
        audience: insertTenant.audience,
        planCode: insertTenant.planCode,
        status: insertTenant.status ?? "draft",
        billingEmail: insertTenant.billingEmail ?? null,
        dataResidency: insertTenant.dataResidency ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const tenant = rows.at(0);
    if (!tenant) throw new Error("Falha ao criar tenant");
    return tenant;
  }

  async upsertTenantMembership(membership: CreateTenantMembership): Promise<TenantMembership> {
    const now = new Date();
    const rows = await getDb()
      .insert(tenantMemberships)
      .values({
        userId: membership.userId,
        tenantId: membership.tenantId,
        membershipRole: membership.membershipRole,
        capabilities: getDefaultTenantCapabilities(membership.membershipRole),
        active: membership.active,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [tenantMemberships.userId, tenantMemberships.tenantId],
        set: {
          membershipRole: membership.membershipRole,
          capabilities: getDefaultTenantCapabilities(membership.membershipRole),
          active: membership.active,
          updatedAt: now,
        },
      })
      .returning();
    const tenantMembership = rows.at(0);
    if (!tenantMembership) throw new Error("Falha ao salvar membership do tenant");
    return tenantMembership;
  }

  async updateTenantMembership(userId: string, tenantId: string, updates: UpdateTenantMembership): Promise<TenantMembership | undefined> {
    const existingRows = await getDb()
      .select()
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.userId, userId), eq(tenantMemberships.tenantId, tenantId)))
      .limit(1);
    const existing = existingRows.at(0);
    if (!existing) return undefined;
    const membershipRole = updates.membershipRole ?? existing.membershipRole;
    const rows = await getDb()
      .update(tenantMemberships)
      .set({
        membershipRole,
        capabilities: getDefaultTenantCapabilities(membershipRole),
        active: updates.active ?? existing.active,
        updatedAt: new Date(),
      })
      .where(and(eq(tenantMemberships.userId, userId), eq(tenantMemberships.tenantId, tenantId)))
      .returning();
    return rows.at(0);
  }

  async getUserCapabilities(userId: string): Promise<TenantCapability[]> {
    const memberships = await this.getTenantMembershipsByUserId(userId);
    const capabilities = memberships
      .filter((membership) => membership.active)
      .flatMap((membership) => membership.capabilities as TenantCapability[]);
    return [...new Set(capabilities)].toSorted((left, right) => left.localeCompare(right));
  }

  async updateTenant(id: string, updates: UpdateTenant): Promise<Tenant | undefined> {
    const rows = await getDb()
      .update(tenants)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();
    return rows.at(0);
  }

  async getAllUsers(): Promise<User[]> {
    return getDb().select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
    return rows.at(0);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return rows.at(0);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const rows = await getDb()
      .insert(users)
      .values({
        id: randomUUID(),
        ...insertUser,
        password: hashedPassword,
        role: insertUser.role ?? "collaborator",
        department: insertUser.department ?? null,
      })
      .returning();
    const user = rows.at(0);
    if (!user) throw new Error("Falha ao criar usuário");
    return user;
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const rows = await getDb()
      .insert(checkIns)
      .values({
        id: randomUUID(),
        ...insertCheckIn,
        createdAt: new Date(),
        flags: insertCheckIn.flags ?? null,
        chatTriggered: insertCheckIn.chatTriggered ?? false,
      })
      .returning();
    const checkIn = rows.at(0);
    if (!checkIn) throw new Error("Falha ao registrar check-in");
    return checkIn;
  }

  async getCheckInsByUserId(userId: string): Promise<CheckIn[]> {
    return getDb()
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.createdAt));
  }

  async getCheckInsByUserIdAndDate(userId: string, date: Date): Promise<CheckIn[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return getDb()
      .select()
      .from(checkIns)
      .where(
        and(
          eq(checkIns.userId, userId),
          gte(checkIns.createdAt, dayStart),
          lte(checkIns.createdAt, dayEnd),
        ),
      )
      .orderBy(desc(checkIns.createdAt));
  }

  async getAllCheckIns(): Promise<CheckIn[]> {
    return getDb().select().from(checkIns).orderBy(desc(checkIns.createdAt));
  }

  async getDailyMissions(userId: string, isoDate: string): Promise<UserMission[]> {
    return getDb()
      .select()
      .from(userMissions)
      .where(
        and(
          eq(userMissions.userId, userId),
          eq(userMissions.date, isoDate),
        ),
      );
  }

  async completeMission(insert: InsertUserMission): Promise<UserMission> {
    const rows = await getDb()
      .insert(userMissions)
      .values({ ...insert, id: randomUUID(), completedAt: new Date() })
      .returning();
    const mission = rows.at(0);
    if (!mission) throw new Error("Falha ao completar missão");
    return mission;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const rows = await getDb()
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return rows.at(0);
  }

  async upsertUserSettings(userId: string, settingsJson: string): Promise<UserSettings> {
    const rows = await getDb()
      .insert(userSettings)
      .values({ userId, settings: settingsJson, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { settings: settingsJson, updatedAt: new Date() },
      })
      .returning();
    const record = rows.at(0);
    if (!record) throw new Error("Falha ao salvar configurações");
    return record;
  }

  async createMomentCheckIn(insert: InsertMomentCheckIn): Promise<MomentCheckIn> {
    const rows = await getDb()
      .insert(momentCheckIns)
      .values({
        id: randomUUID(),
        ...insert,
        createdAt: new Date(),
        flags: insert.flags ?? null,
        chatTriggered: insert.chatTriggered ?? false,
      })
      .returning();
    const checkIn = rows.at(0);
    if (!checkIn) throw new Error("Falha ao registrar momento");
    return checkIn;
  }

  async getMomentCheckInsByUserId(userId: string): Promise<MomentCheckIn[]> {
    return getDb()
      .select()
      .from(momentCheckIns)
      .where(eq(momentCheckIns.userId, userId))
      .orderBy(desc(momentCheckIns.createdAt));
  }

  async getMomentCheckInsByUserIdAndDate(userId: string, date: Date): Promise<MomentCheckIn[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return getDb()
      .select()
      .from(momentCheckIns)
      .where(
        and(
          eq(momentCheckIns.userId, userId),
          gte(momentCheckIns.createdAt, dayStart),
          lte(momentCheckIns.createdAt, dayEnd),
        ),
      )
      .orderBy(desc(momentCheckIns.createdAt));
  }

  async getAllMomentCheckIns(): Promise<MomentCheckIn[]> {
    return getDb()
      .select()
      .from(momentCheckIns)
      .orderBy(desc(momentCheckIns.createdAt));
  }

  async createIncidentReport(insertReport: InsertIncidentReport): Promise<IncidentReport> {
    const rows = await getDb()
      .insert(incidentReports)
      .values({
        id: randomUUID(),
        ...insertReport,
        createdAt: new Date(),
        userId: insertReport.userId ?? null,
        description: insertReport.description ?? null,
        anonymous: insertReport.anonymous ?? true,
        reportMode: insertReport.reportMode ?? "anonymous",
        severity: insertReport.severity ?? null,
        occurrenceWindow: insertReport.occurrenceWindow ?? null,
        location: insertReport.location ?? null,
        peopleInvolved: insertReport.peopleInvolved ?? null,
        followUpRequested: insertReport.followUpRequested ?? false,
      })
      .returning();
    const report = rows.at(0);
    if (!report) throw new Error("Falha ao registrar ocorrência");
    return report;
  }

  async getAllIncidentReports(): Promise<IncidentReport[]> {
    return getDb().select().from(incidentReports);
  }

  async createSolarPointEntry(entry: InsertSolarPoints): Promise<SolarPoints> {
    const rows = await getDb()
      .insert(solarPoints)
      .values({ id: randomUUID(), ...entry, createdAt: new Date() })
      .returning();
    const record = rows.at(0);
    if (!record) throw new Error("Falha ao registrar pontos solares");
    return record;
  }

  async getSolarPointsByUserId(userId: string): Promise<SolarPoints[]> {
    return getDb()
      .select()
      .from(solarPoints)
      .where(eq(solarPoints.userId, userId))
      .orderBy(desc(solarPoints.createdAt));
  }

  async createPulseResponse(insert: InsertPulseResponse): Promise<PulseResponse> {
    const rows = await getDb()
      .insert(pulseResponses)
      .values({ id: randomUUID(), ...insert, submittedAt: new Date() })
      .returning();
    const response = rows.at(0);
    if (!response) throw new Error("Falha ao registrar pulse");
    return response;
  }

  async getPulseResponsesByUserId(userId: string, pulseKey?: string): Promise<PulseResponse[]> {
    const where = pulseKey
      ? and(eq(pulseResponses.userId, userId), eq(pulseResponses.pulseKey, pulseKey))
      : eq(pulseResponses.userId, userId);

    return getDb()
      .select()
      .from(pulseResponses)
      .where(where)
      .orderBy(desc(pulseResponses.submittedAt));
  }

  async getLatestPulseResponseByUserId(userId: string, pulseKey: string): Promise<PulseResponse | undefined> {
    const rows = await getDb()
      .select()
      .from(pulseResponses)
      .where(and(eq(pulseResponses.userId, userId), eq(pulseResponses.pulseKey, pulseKey)))
      .orderBy(desc(pulseResponses.submittedAt))
      .limit(1);
    return rows.at(0);
  }

  async getRhPulseAggregate(): Promise<RhPulseAggregate> {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(now.getDate() - PULSE_SURVEY_INTERVAL_DAYS);
    const prevWindowStart = new Date(windowStart);
    prevWindowStart.setDate(windowStart.getDate() - PULSE_SURVEY_INTERVAL_DAYS);

    const [currentResponses, prevResponses, collaboratorRows] = await Promise.all([
      getDb().select().from(pulseResponses).where(gte(pulseResponses.submittedAt, windowStart)),
      getDb().select().from(pulseResponses).where(and(gte(pulseResponses.submittedAt, prevWindowStart), lte(pulseResponses.submittedAt, windowStart))),
      getDb().select({ id: users.id }).from(users).where(eq(users.role, "collaborator")),
    ]);

    const totalCollaborators = collaboratorRows.length;
    const respondentCount = new Set(currentResponses.map((r) => r.userId)).size;
    const participationRate = totalCollaborators === 0 ? 0 : Math.round((respondentCount / totalCollaborators) * 100);
    const eligible = respondentCount >= ANONYMITY_THRESHOLD;

    const windowDates = currentResponses.map((r) => r.submittedAt?.toISOString().slice(0, 10) ?? "");
    const windowStartIso = windowDates.length > 0 ? [...windowDates].toSorted()[0] : windowStart.toISOString().slice(0, 10);
    const windowEndIso = windowDates.length > 0 ? ([...windowDates].toSorted().at(-1) ?? windowStartIso) : now.toISOString().slice(0, 10);

    function aggregateDimensions(responses: PulseResponse[]): { overall: number; dims: RhPulseDimensionScores } | null {
      if (responses.length === 0) return null;
      const dimBuckets: Record<PulseDimension, number[]> = { pressure_predictability: [], support_care: [], peer_relations: [], role_clarity: [] };
      for (const resp of responses) {
        const summary = parsePulseScoreSummary(resp.scoreSummary);
        if (!summary) continue;
        for (const [dim, score] of Object.entries(summary.dimensionScores) as [PulseDimension, number][]) {
          dimBuckets[dim].push(score);
        }
      }
      const avg = (arr: number[]): number | null => arr.length === 0 ? null : Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
      const dims: RhPulseDimensionScores = {
        pressure_predictability: avg(dimBuckets.pressure_predictability),
        support_care: avg(dimBuckets.support_care),
        peer_relations: avg(dimBuckets.peer_relations),
        role_clarity: avg(dimBuckets.role_clarity),
      };
      const validScores = Object.values(dims).filter((v): v is number => v !== null);
      const overall = validScores.length > 0 ? Math.round(validScores.reduce((s, v) => s + v, 0) / validScores.length) : 0;
      return { overall, dims };
    }

    const prevRespondentCount = new Set(prevResponses.map((r) => r.userId)).size;
    const currentAgg = eligible ? aggregateDimensions(currentResponses) : null;
    const prevAgg = prevRespondentCount >= ANONYMITY_THRESHOLD ? aggregateDimensions(prevResponses) : null;

    const overallScore = currentAgg?.overall ?? null;
    const previousOverallScore = prevAgg?.overall ?? null;

    return {
      windowStart: windowStartIso,
      windowEnd: windowEndIso,
      respondentCount,
      totalCollaborators,
      participationRate,
      eligible,
      overallScore,
      dimensionScores: eligible ? (currentAgg?.dims ?? null) : null,
      previousOverallScore,
      trendDelta: overallScore !== null && previousOverallScore !== null ? overallScore - previousOverallScore : null,
    };
  }

  async createTeamContribution(data: InsertTeamChallengeContribution): Promise<TeamChallengeContribution> {
    const rows = await getDb()
      .insert(teamChallengeContributions)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    const record = rows.at(0);
    if (!record) throw new Error("Falha ao registrar contribuição");
    return record;
  }

  async getTeamContributionsByChallengeAndMonth(challengeId: string, startDate: string, endDate: string): Promise<TeamChallengeContribution[]> {
    return getDb()
      .select()
      .from(teamChallengeContributions)
      .where(
        and(
          eq(teamChallengeContributions.challengeId, challengeId),
          gte(teamChallengeContributions.date, startDate),
          lte(teamChallengeContributions.date, endDate),
        ),
      );
  }

  async getUserTodayTeamContributions(userId: string, challengeId: string, date: string): Promise<TeamChallengeContribution[]> {
    return getDb()
      .select()
      .from(teamChallengeContributions)
      .where(
        and(
          eq(teamChallengeContributions.userId, userId),
          eq(teamChallengeContributions.challengeId, challengeId),
          eq(teamChallengeContributions.date, date),
        ),
      );
  }

  async createCommunityMessage(insert: InsertCommunityMessage): Promise<CommunityMessage> {
    const rows = await getDb()
      .insert(communityMessages)
      .values({ id: randomUUID(), ...insert, likeCount: 0, createdAt: new Date() })
      .returning();
    const record = rows.at(0);
    if (!record) throw new Error("Falha ao criar mensagem comunitária");
    return record;
  }

  async getCommunityMessages(limit: number, offset: number): Promise<CommunityMessage[]> {
    return getDb()
      .select()
      .from(communityMessages)
      .orderBy(desc(communityMessages.likeCount), desc(communityMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getCommunityMessageById(id: string): Promise<CommunityMessage | undefined> {
    const rows = await getDb().select().from(communityMessages).where(eq(communityMessages.id, id)).limit(1);
    return rows.at(0);
  }

  async toggleMessageLike(messageId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const db = getDb();

    const msg = await this.getCommunityMessageById(messageId);
    if (!msg) throw new Error("Mensagem não encontrada");

    const existing = await db
      .select()
      .from(messageLikes)
      .where(and(eq(messageLikes.messageId, messageId), eq(messageLikes.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(messageLikes).where(and(eq(messageLikes.messageId, messageId), eq(messageLikes.userId, userId)));
      const updated = await db
        .update(communityMessages)
        .set({ likeCount: sql`GREATEST(0, ${communityMessages.likeCount} - 1)` })
        .where(eq(communityMessages.id, messageId))
        .returning();
      return { liked: false, likeCount: updated[0]?.likeCount ?? 0 };
    }

    await db.insert(messageLikes).values({ messageId, userId, createdAt: new Date() });
    const updated = await db
      .update(communityMessages)
      .set({ likeCount: sql`${communityMessages.likeCount} + 1` })
      .where(eq(communityMessages.id, messageId))
      .returning();
    return { liked: true, likeCount: updated[0]?.likeCount ?? 0 };
  }

  async getUserLikedMessageIds(userId: string): Promise<string[]> {
    const rows = await getDb()
      .select({ messageId: messageLikes.messageId })
      .from(messageLikes)
      .where(eq(messageLikes.userId, userId));
    return rows.map((r) => r.messageId);
  }

  async deleteUserData(userId: string): Promise<void> {
    const db = getDb();
    const userConvs = await db.select({ id: chatConversations.id }).from(chatConversations).where(eq(chatConversations.userId, userId));
    for (const c of userConvs) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, c.id));
    }
    await db.delete(chatConversations).where(eq(chatConversations.userId, userId));
    await db.delete(checkIns).where(eq(checkIns.userId, userId));
    await db.delete(momentCheckIns).where(eq(momentCheckIns.userId, userId));
    await db.delete(userMissions).where(eq(userMissions.userId, userId));
    await db.delete(solarPoints).where(eq(solarPoints.userId, userId));
    await db.delete(solarStreaks).where(eq(solarStreaks.userId, userId));
    await db.delete(pulseResponses).where(eq(pulseResponses.userId, userId));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    await db.delete(teamChallengeContributions).where(eq(teamChallengeContributions.userId, userId));
    await db.delete(messageLikes).where(eq(messageLikes.userId, userId));
    await db.delete(communityMessages).where(eq(communityMessages.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async resetUserActivity(userId: string): Promise<void> {
    const db = getDb();
    const userConvs = await db.select({ id: chatConversations.id }).from(chatConversations).where(eq(chatConversations.userId, userId));
    for (const c of userConvs) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, c.id));
    }
    await db.delete(chatConversations).where(eq(chatConversations.userId, userId));
    await db.delete(checkIns).where(eq(checkIns.userId, userId));
    await db.delete(momentCheckIns).where(eq(momentCheckIns.userId, userId));
    await db.delete(userMissions).where(eq(userMissions.userId, userId));
    await db.delete(solarPoints).where(eq(solarPoints.userId, userId));
    await db.delete(solarStreaks).where(eq(solarStreaks.userId, userId));
    await db.delete(pulseResponses).where(eq(pulseResponses.userId, userId));
    await db.delete(teamChallengeContributions).where(eq(teamChallengeContributions.userId, userId));
    await db.delete(messageLikes).where(eq(messageLikes.userId, userId));
    await db.delete(communityMessages).where(eq(communityMessages.userId, userId));
  }

  async createChatConversation(conv: InsertChatConversation): Promise<ChatConversation> {
    const id = randomUUID();
    const now = new Date();
    const rows = await getDb()
      .insert(chatConversations)
      .values({
        id,
        userId: conv.userId,
        title: conv.title ?? null,
        orchestratorSessionId: conv.orchestratorSessionId ?? null,
        orchestratorConversationId: conv.orchestratorConversationId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  }

  async updateChatConversation(id: string, updates: Partial<Pick<ChatConversation, "title" | "orchestratorSessionId" | "orchestratorConversationId">>): Promise<ChatConversation | undefined> {
    const rows = await getDb()
      .update(chatConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chatConversations.id, id))
      .returning();
    return rows.at(0);
  }

  async getChatConversationsByUserId(userId: string): Promise<ChatConversation[]> {
    return getDb()
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt));
  }

  async getChatConversation(id: string): Promise<ChatConversation | undefined> {
    const rows = await getDb()
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .limit(1);
    return rows.at(0);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessageType> {
    const id = randomUUID();
    const rows = await getDb()
      .insert(chatMessages)
      .values({
        id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(),
      })
      .returning();
    return rows[0];
  }

  async getChatMessagesByConversationId(conversationId: string): Promise<ChatMessageType[]> {
    return getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    await getDb()
      .update(users)
      .set({ password: hashed })
      .where(eq(users.id, userId));
  }
}
