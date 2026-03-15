import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
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
} from "@shared/schema";
import type {
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
  TeamChallengeContribution,
  InsertTeamChallengeContribution,
  CommunityMessage,
  InsertCommunityMessage,
  MessageLike,
} from "@shared/schema";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { BaseStorage } from "./storage";
import { getDb } from "./db";

export class DrizzleStorage extends BaseStorage {
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
    const existing = await db
      .select()
      .from(messageLikes)
      .where(and(eq(messageLikes.messageId, messageId), eq(messageLikes.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(messageLikes).where(eq(messageLikes.id, existing[0].id));
      const updated = await db
        .update(communityMessages)
        .set({ likeCount: sql`GREATEST(0, ${communityMessages.likeCount} - 1)` })
        .where(eq(communityMessages.id, messageId))
        .returning();
      return { liked: false, likeCount: updated[0]?.likeCount ?? 0 };
    }

    await db.insert(messageLikes).values({ id: randomUUID(), messageId, userId, createdAt: new Date() });
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
}
