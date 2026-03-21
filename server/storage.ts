import { type User, type InsertUser, type TenantPlan, type InsertTenantPlan, type UpdateTenantPlan, type Tenant, type InsertTenant, type UpdateTenant, type TenantMembership, type CreateTenantMembership, type UpdateTenantMembership, type TenantCapability, type BillingPeriod, type CreateBillingPeriod, type UpdateBillingPeriodUsage, type CheckIn, type InsertCheckIn, type MomentCheckIn, type InsertMomentCheckIn, type IncidentReport, type InsertIncidentReport, type UserMission, type InsertUserMission, type UserSettings, type CheckInHistoryRecord, type SolarPoints, type InsertSolarPoints, type TeamChallengeContribution, type InsertTeamChallengeContribution, type PulseResponse, type InsertPulseResponse, type CommunityMessage, type InsertCommunityMessage, type MessageLike, type ChatConversation, type InsertChatConversation, type ChatMessage, type InsertChatMessage, type RhPulseAggregate, type RhPulseDimensionScores, getDefaultTenantCapabilities } from "@shared/schema";
import { ANONYMITY_THRESHOLD, PULSE_SURVEY_INTERVAL_DAYS, getWorkdayDate } from "@shared/constants";
import { parsePulseScoreSummary, type PulseDimension } from "@shared/pulse-survey";
import { devNow } from "@shared/dev-clock";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

type ScoreDomainId = "recarga" | "estado-do-dia" | "seguranca-relacional";
type SkyState = "clear" | "partly-cloudy" | "protective-cloud" | "respiro";
type RiskLevel = "low" | "medium" | "high";
type AlertSeverity = "low" | "medium" | "high";

interface DomainScores {
  recarga: number;
  "estado-do-dia": number;
  "seguranca-relacional": number;
}

interface DomainAverage {
  domain: ScoreDomainId;
  label: string;
  avg: number;
}

interface DeptAggregate {
  department: string;
  headcount: number;
  participationRate: number;
  domainAverages: DomainAverage[];
  riskLevel: RiskLevel;
  stressIndex: number;
  burnoutIndex: number;
}

interface AggregateAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  department: string;
  timestamp: string;
}

interface TrendPoint {
  month: string;
  value: number | null;
  forecast: number | null;
}

interface MoodSlice {
  name: string;
  value: number;
  color: string;
}

type ChatConversationUpdates = Partial<Pick<ChatConversation, "title" | "orchestratorSessionId" | "orchestratorConversationId">>;

export interface TodayScoresSnapshot {
  domainScores: DomainScores;
  skyState: SkyState;
  solarHaloLevel: number;
  flags: string[];
  hasCheckedIn: boolean;
}

export interface RHAggregateData {
  departments: DeptAggregate[];
  alerts: AggregateAlert[];
  participation: number;
  totalCollaborators: number;
  activeCollaborators: number;
  averageWellbeing: number;
  trendBurnout: TrendPoint[];
  moodDistribution: MoodSlice[];
}

const DOMAIN_LABELS: Record<ScoreDomainId, string> = {
  recarga: "Recarga",
  "estado-do-dia": "Estado do dia",
  "seguranca-relacional": "Segurança relacional",
};

const EMPTY_DOMAIN_SCORES: DomainScores = {
  recarga: 0,
  "estado-do-dia": 0,
  "seguranca-relacional": 0,
};

function emptyDomainScores(): DomainScores {
  return { ...EMPTY_DOMAIN_SCORES };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function arithmeticMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isSameDay(left: Date | null | undefined, right: Date): boolean {
  return left instanceof Date && getIsoDay(left) === getIsoDay(right);
}

function parseDomainScores(raw: string): DomainScores {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyDomainScores();
    const obj = parsed as Record<string, unknown>;
    return {
      recarga: clampScore(typeof obj.recarga === "number" ? obj.recarga : 0),
      "estado-do-dia": clampScore(typeof obj["estado-do-dia"] === "number" ? obj["estado-do-dia"] : 0),
      "seguranca-relacional": clampScore(typeof obj["seguranca-relacional"] === "number" ? obj["seguranca-relacional"] : 0),
    };
  } catch (error: unknown) {
    console.warn("Failed to parse domain scores:", error);
    return emptyDomainScores();
  }
}

function buildSkySnapshot(domainScores: DomainScores, flags: string[]): Omit<TodayScoresSnapshot, "flags" | "hasCheckedIn" | "domainScores"> {
  const lowestScore = Math.min(
    domainScores.recarga,
    domainScores["estado-do-dia"],
    domainScores["seguranca-relacional"],
  );

  if (flags.includes("harassment_signal") || lowestScore < 25) {
    return { skyState: "respiro", solarHaloLevel: 0.2 };
  }
  if (lowestScore < 45) {
    return { skyState: "protective-cloud", solarHaloLevel: 0.4 };
  }
  if (lowestScore < 75) {
    return { skyState: "partly-cloudy", solarHaloLevel: 0.65 };
  }
  return { skyState: "clear", solarHaloLevel: 0.9 };
}

function getSleepAnswer(recargaScore: number): string {
  if (recargaScore >= 75) {
    return "restorative";
  }
  if (recargaScore >= 50) {
    return "acceptable";
  }
  if (recargaScore >= 25) {
    return "agitated";
  }
  return "terrible";
}

function getEnergyAnswer(recargaScore: number): string {
  if (recargaScore >= 75) {
    return "full";
  }
  if (recargaScore >= 50) {
    return "ok";
  }
  if (recargaScore >= 25) {
    return "low";
  }
  return "empty";
}

function getWorkRelationAnswer(relationalScore: number): string {
  if (relationalScore >= 75) {
    return "supported";
  }
  if (relationalScore >= 50) {
    return "normal";
  }
  if (relationalScore >= 25) {
    return "tense";
  }
  return "pressured";
}

function buildSeedAnswers(domainScores: DomainScores, flags: string[]): string {
  return JSON.stringify({
    sleep: getSleepAnswer(domainScores.recarga),
    energy: getEnergyAnswer(domainScores.recarga),
    safety: getWorkRelationAnswer(domainScores["seguranca-relacional"]),
    context_tags: flags,
  });
}

function getMonthLabel(date: Date): string {
  const label = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + delta);
  return next;
}

function getRiskLevel(stressIndex: number, burnoutIndex: number): RiskLevel {
  const peak = Math.max(stressIndex, burnoutIndex);
  if (peak >= 65) {
    return "high";
  }
  if (peak >= 45) {
    return "medium";
  }
  return "low";
}

function getAlertSeverity(riskLevel: RiskLevel): AlertSeverity {
  return riskLevel;
}

function categorizeMood(record: CheckIn): string {
  const scores = parseDomainScores(record.domainScores);
  const flags = record.flags ?? [];
  if (flags.includes("harassment_signal") || scores["seguranca-relacional"] < 30) {
    return "Tenso";
  }
  if (scores["estado-do-dia"] < 45) {
    return "Ansioso";
  }
  if (scores.recarga >= 70 && scores["seguranca-relacional"] >= 60) {
    return "Calmo";
  }
  if (average(Object.values(scores)) >= 70) {
    return "Bem";
  }
  return "Outros";
}

export interface IStorage {
  getAllTenantPlans(): Promise<TenantPlan[]>;
  getTenantPlan(id: string): Promise<TenantPlan | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  getAllTenantMemberships(): Promise<TenantMembership[]>;
  getTenantMembershipsByUserId(userId: string): Promise<TenantMembership[]>;
  createTenantPlan(plan: InsertTenantPlan): Promise<TenantPlan>;
  updateTenantPlan(id: string, updates: UpdateTenantPlan): Promise<TenantPlan | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  upsertTenantMembership(membership: CreateTenantMembership): Promise<TenantMembership>;
  updateTenantMembership(userId: string, tenantId: string, updates: UpdateTenantMembership): Promise<TenantMembership | undefined>;
  updateTenant(id: string, updates: UpdateTenant): Promise<Tenant | undefined>;
  // Billing period contract tracking
  getTenantBillingPeriods(tenantId: string): Promise<BillingPeriod[]>;
  getActiveBillingPeriod(tenantId: string): Promise<BillingPeriod | undefined>;
  createBillingPeriod(data: CreateBillingPeriod): Promise<BillingPeriod>;
  updateBillingPeriodUsage(id: string, updates: UpdateBillingPeriodUsage): Promise<BillingPeriod | undefined>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getCheckInsByUserId(userId: string): Promise<CheckIn[]>;
  getCheckInsByUserIdAndDate(userId: string, date: Date): Promise<CheckIn[]>;
  getAllCheckIns(): Promise<CheckIn[]>;
  getAllUsers(): Promise<User[]>;
  getTodayScoresByUserId(userId: string): Promise<TodayScoresSnapshot>;
  getRhAggregate(): Promise<RHAggregateData>;
  getDailyMissions(userId: string, isoDate: string): Promise<UserMission[]>;
  completeMission(mission: InsertUserMission): Promise<UserMission>;
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(userId: string, settingsJson: string): Promise<UserSettings>;
  getHistoryByUserId(userId: string, days: number | null): Promise<CheckInHistoryRecord[]>;
  createMomentCheckIn(checkIn: InsertMomentCheckIn): Promise<MomentCheckIn>;
  getMomentCheckInsByUserId(userId: string): Promise<MomentCheckIn[]>;
  getMomentCheckInsByUserIdAndDate(userId: string, date: Date): Promise<MomentCheckIn[]>;
  getAllMomentCheckIns(): Promise<MomentCheckIn[]>;
  createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport>;
  getAllIncidentReports(): Promise<IncidentReport[]>;
  createSolarPointEntry(entry: InsertSolarPoints): Promise<SolarPoints>;
  getSolarPointsByUserId(userId: string): Promise<SolarPoints[]>;
  createPulseResponse(response: InsertPulseResponse): Promise<PulseResponse>;
  getPulseResponsesByUserId(userId: string, pulseKey?: string): Promise<PulseResponse[]>;
  getLatestPulseResponseByUserId(userId: string, pulseKey: string): Promise<PulseResponse | undefined>;
  getRhPulseAggregate(): Promise<RhPulseAggregate>;
  deleteUserData(userId: string): Promise<void>;
  resetUserActivity(userId: string): Promise<void>;
  // ── Team challenges ───────────────────────────────
  createTeamContribution(data: InsertTeamChallengeContribution): Promise<TeamChallengeContribution>;
  getTeamContributionsByChallengeAndMonth(challengeId: string, startDate: string, endDate: string): Promise<TeamChallengeContribution[]>;
  getUserTodayTeamContributions(userId: string, challengeId: string, date: string): Promise<TeamChallengeContribution[]>;
  // ── Community messages ──────────────────────────────
  createCommunityMessage(msg: InsertCommunityMessage): Promise<CommunityMessage>;
  getCommunityMessages(limit: number, offset: number): Promise<CommunityMessage[]>;
  getCommunityMessageById(id: string): Promise<CommunityMessage | undefined>;
  toggleMessageLike(messageId: string, userId: string): Promise<{ liked: boolean; likeCount: number }>;
  getUserLikedMessageIds(userId: string): Promise<string[]>;
  // ── Chat conversations ─────────────────────────────
  createChatConversation(conv: InsertChatConversation): Promise<ChatConversation>;
  updateChatConversation(id: string, updates: ChatConversationUpdates): Promise<ChatConversation | undefined>;
  getChatConversationsByUserId(userId: string): Promise<ChatConversation[]>;
  getChatConversation(id: string): Promise<ChatConversation | undefined>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesByConversationId(conversationId: string): Promise<ChatMessage[]>;
  getUserCapabilities(userId: string): Promise<TenantCapability[]>;
  // ── Auth ────────────────────────────────────────────────
  /** Hash newPassword and persist it. Does NOT verify the old password — caller is responsible. */
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
}

/** Algorithm-heavy computed methods shared across all storage backends. */
export abstract class BaseStorage implements IStorage {
  abstract getAllTenantPlans(): Promise<TenantPlan[]>;
  abstract getTenantPlan(id: string): Promise<TenantPlan | undefined>;
  abstract getAllTenants(): Promise<Tenant[]>;
  abstract getTenant(id: string): Promise<Tenant | undefined>;
  abstract getAllTenantMemberships(): Promise<TenantMembership[]>;
  abstract getTenantMembershipsByUserId(userId: string): Promise<TenantMembership[]>;
  abstract createTenantPlan(plan: InsertTenantPlan): Promise<TenantPlan>;
  abstract updateTenantPlan(id: string, updates: UpdateTenantPlan): Promise<TenantPlan | undefined>;
  abstract createTenant(tenant: InsertTenant): Promise<Tenant>;
  abstract upsertTenantMembership(membership: CreateTenantMembership): Promise<TenantMembership>;
  abstract updateTenantMembership(userId: string, tenantId: string, updates: UpdateTenantMembership): Promise<TenantMembership | undefined>;
  abstract updateTenant(id: string, updates: UpdateTenant): Promise<Tenant | undefined>;
  abstract getTenantBillingPeriods(tenantId: string): Promise<BillingPeriod[]>;
  abstract getActiveBillingPeriod(tenantId: string): Promise<BillingPeriod | undefined>;
  abstract createBillingPeriod(data: CreateBillingPeriod): Promise<BillingPeriod>;
  abstract updateBillingPeriodUsage(id: string, updates: UpdateBillingPeriodUsage): Promise<BillingPeriod | undefined>;
  abstract getAllUsers(): Promise<User[]>;
  abstract getUser(id: string): Promise<User | undefined>;
  abstract getUserByUsername(username: string): Promise<User | undefined>;
  abstract createUser(user: InsertUser): Promise<User>;
  abstract createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  abstract getCheckInsByUserId(userId: string): Promise<CheckIn[]>;
  abstract getCheckInsByUserIdAndDate(userId: string, date: Date): Promise<CheckIn[]>;
  abstract getAllCheckIns(): Promise<CheckIn[]>;
  abstract getDailyMissions(userId: string, isoDate: string): Promise<UserMission[]>;
  abstract completeMission(mission: InsertUserMission): Promise<UserMission>;
  abstract getUserSettings(userId: string): Promise<UserSettings | undefined>;
  abstract upsertUserSettings(userId: string, settingsJson: string): Promise<UserSettings>;
  abstract createMomentCheckIn(checkIn: InsertMomentCheckIn): Promise<MomentCheckIn>;
  abstract getMomentCheckInsByUserId(userId: string): Promise<MomentCheckIn[]>;
  abstract getMomentCheckInsByUserIdAndDate(userId: string, date: Date): Promise<MomentCheckIn[]>;
  abstract getAllMomentCheckIns(): Promise<MomentCheckIn[]>;
  abstract createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport>;
  abstract getAllIncidentReports(): Promise<IncidentReport[]>;
  abstract createSolarPointEntry(entry: InsertSolarPoints): Promise<SolarPoints>;
  abstract getSolarPointsByUserId(userId: string): Promise<SolarPoints[]>;
  abstract createPulseResponse(response: InsertPulseResponse): Promise<PulseResponse>;
  abstract getPulseResponsesByUserId(userId: string, pulseKey?: string): Promise<PulseResponse[]>;
  abstract getLatestPulseResponseByUserId(userId: string, pulseKey: string): Promise<PulseResponse | undefined>;
  abstract getRhPulseAggregate(): Promise<RhPulseAggregate>;
  abstract deleteUserData(userId: string): Promise<void>;
  abstract resetUserActivity(userId: string): Promise<void>;
  abstract createTeamContribution(data: InsertTeamChallengeContribution): Promise<TeamChallengeContribution>;
  abstract getTeamContributionsByChallengeAndMonth(challengeId: string, startDate: string, endDate: string): Promise<TeamChallengeContribution[]>;
  abstract getUserTodayTeamContributions(userId: string, challengeId: string, date: string): Promise<TeamChallengeContribution[]>;
  abstract createCommunityMessage(msg: InsertCommunityMessage): Promise<CommunityMessage>;
  abstract getCommunityMessages(limit: number, offset: number): Promise<CommunityMessage[]>;
  abstract getCommunityMessageById(id: string): Promise<CommunityMessage | undefined>;
  abstract toggleMessageLike(messageId: string, userId: string): Promise<{ liked: boolean; likeCount: number }>;
  abstract getUserLikedMessageIds(userId: string): Promise<string[]>;
  abstract createChatConversation(conv: InsertChatConversation): Promise<ChatConversation>;
  abstract updateChatConversation(id: string, updates: ChatConversationUpdates): Promise<ChatConversation | undefined>;
  abstract getChatConversationsByUserId(userId: string): Promise<ChatConversation[]>;
  abstract getChatConversation(id: string): Promise<ChatConversation | undefined>;
  abstract createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  abstract getChatMessagesByConversationId(conversationId: string): Promise<ChatMessage[]>;
  abstract updateUserPassword(userId: string, newPassword: string): Promise<void>;

  async getUserCapabilities(userId: string): Promise<TenantCapability[]> {
    const capabilities = (await this.getTenantMembershipsByUserId(userId))
      .filter((membership) => membership.active)
      .flatMap((membership) => membership.capabilities as TenantCapability[]);
    return [...new Set(capabilities)].toSorted((left, right) => left.localeCompare(right));
  }

  async getTodayScoresByUserId(userId: string): Promise<TodayScoresSnapshot> {
    const todayCheckIn = (await this.getCheckInsByUserIdAndDate(userId, getWorkdayDate(devNow()))).at(0);
    if (!todayCheckIn) {
      return {
        domainScores: emptyDomainScores(),
        skyState: "partly-cloudy",
        solarHaloLevel: 0.5,
        flags: [],
        hasCheckedIn: false,
      };
    }

    const domainScores = parseDomainScores(todayCheckIn.domainScores);
    const flags = todayCheckIn.flags ?? [];
    const skySnapshot = buildSkySnapshot(domainScores, flags);

    return {
      domainScores,
      flags,
      hasCheckedIn: true,
      ...skySnapshot,
    };
  }

  async getRhAggregate(): Promise<RHAggregateData> {
    const collaborators = (await this.getAllUsers()).filter((user) => user.role === "collaborator");
    const allCheckIns = await this.getAllCheckIns();
    const now = devNow();
    const days30Ago = new Date(now);
    days30Ago.setDate(now.getDate() - 30);
    const days14Ago = new Date(now);
    days14Ago.setDate(now.getDate() - 14);

    const recent30 = allCheckIns.filter((checkIn) => (checkIn.createdAt?.getTime() || 0) >= days30Ago.getTime());
    const recent14 = allCheckIns.filter((checkIn) => (checkIn.createdAt?.getTime() || 0) >= days14Ago.getTime());
    const activeCollaborators = new Set(recent30.map((checkIn) => checkIn.userId)).size;

    const departments = Array.from(
      collaborators.reduce((map, user) => {
        const department = user.department ?? "Sem área";
        const users = map.get(department) ?? [];
        users.push(user);
        map.set(department, users);
        return map;
      }, new Map<string, User[]>()),
    )
      .map(([department, departmentUsers]) => {
        const userIds = new Set(departmentUsers.map((user) => user.id));
        const departmentRecords30 = recent30.filter((checkIn) => userIds.has(checkIn.userId));
        const departmentRecords14 = recent14.filter((checkIn) => userIds.has(checkIn.userId));
        const participationRate = clampScore((new Set(departmentRecords30.map((checkIn) => checkIn.userId)).size / Math.max(1, departmentUsers.length)) * 100);

        const domainAverages = (Object.keys(DOMAIN_LABELS) as ScoreDomainId[]).map((domain) => ({
          domain,
          label: DOMAIN_LABELS[domain],
          avg: average(departmentRecords14.map((checkIn) => parseDomainScores(checkIn.domainScores)[domain])),
        }));

        const stressIndex = clampScore(100 - average(departmentRecords14.map((checkIn) => average([
          parseDomainScores(checkIn.domainScores).recarga,
          parseDomainScores(checkIn.domainScores)["estado-do-dia"],
        ]))));
        const burnoutIndex = clampScore(100 - average(departmentRecords14.map((checkIn) => average([
          parseDomainScores(checkIn.domainScores).recarga,
          parseDomainScores(checkIn.domainScores)["seguranca-relacional"],
        ]))));
        const riskLevel = getRiskLevel(stressIndex, burnoutIndex);

        return {
          department,
          headcount: departmentUsers.length,
          participationRate,
          domainAverages,
          riskLevel,
          stressIndex,
          burnoutIndex,
        } satisfies DeptAggregate;
      })
      .filter((dept) => dept.headcount >= ANONYMITY_THRESHOLD)
      .toSorted((left, right) => right.burnoutIndex - left.burnoutIndex);

    const averageWellbeing = average(
      recent14.map((checkIn) => average(Object.values(parseDomainScores(checkIn.domainScores)))),
    );

    const alerts = departments
      .filter((department) => department.riskLevel !== "low")
      .slice(0, 3)
      .map((department, index) => ({
        id: `alert-${index + 1}`,
        severity: getAlertSeverity(department.riskLevel),
        title:
          department.riskLevel === "high"
            ? "Área com sinal agregado elevado"
            : "Área em atenção recente",
        description:
          department.riskLevel === "high"
            ? `${department.department} apresenta proxy agregado de desgaste em ${department.burnoutIndex}% e segurança relacional recente de ${department.domainAverages.find((item) => item.domain === "seguranca-relacional")?.avg ?? 0}%.`
            : `${department.department} registra proxy agregado de estresse em ${department.stressIndex}% com participação de ${department.participationRate}% nos últimos 30 dias.`,
        department: department.department,
        timestamp: "agora",
      } satisfies AggregateAlert));

    const actualMonths = Array.from({ length: 6 }, (_, index) => addMonths(new Date(now.getFullYear(), now.getMonth(), 1), index - 5));
    const actualTrend = actualMonths.map((monthDate) => {
      const monthKey = getMonthKey(monthDate);
      const monthRecords = allCheckIns.filter((checkIn) => {
        if (!(checkIn.createdAt instanceof Date)) {
          return false;
        }
        return getMonthKey(checkIn.createdAt) === monthKey;
      });

      return {
        month: getMonthLabel(monthDate),
        value: monthRecords.length > 0
          ? clampScore(100 - average(monthRecords.map((checkIn) => average([
              parseDomainScores(checkIn.domainScores).recarga,
              parseDomainScores(checkIn.domainScores)["seguranca-relacional"],
            ]))))
          : null,
      };
    });

    const actualValues = actualTrend.map((point) => point.value).filter((value): value is number => value !== null);
    const avgDelta = actualValues.length >= 2
      ? arithmeticMean(actualValues.slice(1).map((value, index) => value - actualValues[index]))
      : 3;
    const lastActualValue = actualValues.at(-1) ?? 45;
    const forecastTrend = Array.from({ length: 3 }, (_, index) => ({
      month: getMonthLabel(addMonths(actualMonths.at(-1) ?? now, index + 1)),
      forecast: clampScore(lastActualValue + avgDelta * (index + 1)),
    }));

    const trendBurnout: TrendPoint[] = [
      ...actualTrend.map((point) => ({ month: point.month, value: point.value, forecast: null })),
      ...forecastTrend.map((point) => ({ month: point.month, value: null, forecast: point.forecast })),
    ];

    const latestByUser = recent30.reduce((map, checkIn) => {
      const existing = map.get(checkIn.userId);
      const existingTime = existing?.createdAt?.getTime() ?? 0;
      const currentTime = checkIn.createdAt?.getTime() ?? 0;
      if (currentTime > existingTime) {
        map.set(checkIn.userId, checkIn);
      }
      return map;
    }, new Map<string, CheckIn>());

    const moodCounts = Array.from(latestByUser.values()).reduce((counts, checkIn) => {
      const category = categorizeMood(checkIn);
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const totalMoodBase = Math.max(1, Array.from(latestByUser.values()).length);
    const moodPalette: Record<string, string> = {
      Bem: "#34d399",
      Ansioso: "#f87171",
      Calmo: "#22d3ee",
      Tenso: "#fb923c",
      Outros: "#94a3b8",
    };
    const moodDistribution = Object.entries(moodCounts)
      .map(([name, count]) => ({
        name,
        value: clampScore((count / totalMoodBase) * 100),
        color: moodPalette[name] ?? moodPalette.Outros,
      }))
      .toSorted((left, right) => right.value - left.value);

    return {
      departments,
      alerts,
      participation: clampScore((activeCollaborators / Math.max(1, collaborators.length)) * 100),
      totalCollaborators: collaborators.length,
      activeCollaborators,
      averageWellbeing,
      trendBurnout,
      moodDistribution,
    };
  }

  async getHistoryByUserId(userId: string, days: number | null): Promise<CheckInHistoryRecord[]> {
    const all = await this.getCheckInsByUserId(userId); // sorted newest first
    const cutoffTime = days === null
      ? 0
      : Date.now() - days * 24 * 60 * 60 * 1000;

    return all
      .filter((c) => (c.createdAt?.getTime() ?? 0) >= cutoffTime)
      .map((c): CheckInHistoryRecord => ({
        date: getIsoDay(c.createdAt ?? devNow()),
        domainScores: parseDomainScores(c.domainScores),
        flags: c.flags ?? [],
      }))
      .toSorted((a, b) => a.date.localeCompare(b.date)); // oldest → newest for charts
  }
}

export class MemStorage extends BaseStorage {
  private readonly tenantPlansMap: Map<string, TenantPlan>;
  private readonly tenantsMap: Map<string, Tenant>;
  private readonly tenantMembershipsMap: Map<string, TenantMembership>;
  private readonly billingPeriodsMap: Map<string, BillingPeriod>;
  private readonly users: Map<string, User>;
  private readonly checkIns: Map<string, CheckIn>;
  private readonly momentCheckIns: Map<string, MomentCheckIn>;
  private readonly incidentReports: Map<string, IncidentReport>;
  private readonly userMissionsMap: Map<string, UserMission>;
  private readonly userSettingsMap: Map<string, UserSettings>;
  private readonly solarPointsMap: Map<string, SolarPoints>;
  private readonly pulseResponsesMap: Map<string, PulseResponse>;
  private readonly teamContributionsMap: Map<string, TeamChallengeContribution>;
  private readonly communityMessagesMap: Map<string, CommunityMessage>;
  private readonly messageLikesMap: Map<string, MessageLike>;
  private readonly chatConversationsMap: Map<string, ChatConversation>;
  private readonly chatMessagesMap: Map<string, ChatMessage>;

  constructor() {
    super();
    this.tenantPlansMap = new Map();
    this.tenantsMap = new Map();
    this.tenantMembershipsMap = new Map();
    this.billingPeriodsMap = new Map();
    this.users = new Map();
    this.checkIns = new Map();
    this.momentCheckIns = new Map();
    this.incidentReports = new Map();
    this.userMissionsMap = new Map();
    this.userSettingsMap = new Map();
    this.solarPointsMap = new Map();
    this.pulseResponsesMap = new Map();
    this.teamContributionsMap = new Map();
    this.communityMessagesMap = new Map();
    this.messageLikesMap = new Map();
    this.chatConversationsMap = new Map();
    this.chatMessagesMap = new Map();
    this.seedData();
  }

  private tenantMembershipKey(userId: string, tenantId: string): string {
    return `${userId}:${tenantId}`;
  }

  private removeEntriesForUser<T extends { userId: string | null }>(
    store: Map<string, T>,
    userId: string,
  ): void {
    for (const [id, entry] of store) {
      if (entry.userId === userId) {
        store.delete(id);
      }
    }
  }

  private seedData() {
    const defaultPlans: TenantPlan[] = [
      {
        id: "plan-btc-starter",
        code: "btc-starter",
        name: "BTC Starter",
        audience: "btc",
        description: "Plano de consumo com isolamento lógico e limites moderados.",
        isolationProfile: "pooled",
        monthlyActiveUserLimit: 50000,
        priceMonthlyUsdCents: 14900, // $149/mês
        billingCycle: "monthly",
        active: true,
        createdAt: devNow(),
      },
      {
        id: "plan-btb-scale",
        code: "btb-scale",
        name: "BTB Scale",
        audience: "btb",
        description: "Plano corporativo com controles ampliados e isolamento reforçado.",
        isolationProfile: "isolated-schema",
        monthlyActiveUserLimit: 250000,
        priceMonthlyUsdCents: 49900, // $499/mês
        billingCycle: "monthly",
        active: true,
        createdAt: devNow(),
      },
      {
        id: "plan-btg-sovereign",
        code: "btg-sovereign",
        name: "BTG Sovereign",
        audience: "btg",
        description: "Plano soberano com isolamento dedicado para operação crítica.",
        isolationProfile: "dedicated-account",
        monthlyActiveUserLimit: null,
        priceMonthlyUsdCents: null, // contrato enterprise personalizado
        billingCycle: null,
        active: true,
        createdAt: devNow(),
      },
    ];

    defaultPlans.forEach((plan) => {
      this.tenantPlansMap.set(plan.id, plan);
    });

    const defaultTenant: Tenant = {
      id: "tenant-lumina-demo",
      slug: "lumina-demo",
      name: "Lumina Demo",
      audience: "btb",
      planCode: "btb-scale",
      status: "active",
      billingEmail: "billing@lumina.demo",
      dataResidency: "br-south-1",
      createdAt: devNow(),
      updatedAt: devNow(),
    };
    this.tenantsMap.set(defaultTenant.id, defaultTenant);

    // Seed billing period — active contract for the demo tenant
    const seedPeriod: BillingPeriod = {
      id: "bp-lumina-demo-2026-q1",
      tenantId: "tenant-lumina-demo",
      planCode: "btb-scale",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      mauLimit: 250000,
      mauUsed: 14820,
      status: "active",
      createdAt: devNow(),
      updatedAt: devNow(),
    };
    this.billingPeriodsMap.set(seedPeriod.id, seedPeriod);

    // Seed passwords are hashed at startup. Plain-text only in this comment for dev reference: "Senha@123"
    const seedHash = bcrypt.hashSync("Senha@123", 10);
    const departmentProfiles: Record<string, DomainScores> = {
      Vendas: { recarga: 42, "estado-do-dia": 48, "seguranca-relacional": 36 },
      TI: { recarga: 62, "estado-do-dia": 58, "seguranca-relacional": 60 },
      Marketing: { recarga: 75, "estado-do-dia": 72, "seguranca-relacional": 78 },
      Financeiro: { recarga: 55, "estado-do-dia": 57, "seguranca-relacional": 52 },
      Operações: { recarga: 47, "estado-do-dia": 50, "seguranca-relacional": 44 },
      "Recursos Humanos": { recarga: 68, "estado-do-dia": 66, "seguranca-relacional": 74 },
    };

    const createSeedCheckIn = (userId: string, date: Date, baseScores: DomainScores) => {
      const scores: DomainScores = {
        recarga: clampScore(baseScores.recarga + Math.round((Math.random() - 0.5) * 24)),
        "estado-do-dia": clampScore(baseScores["estado-do-dia"] + Math.round((Math.random() - 0.5) * 24)),
        "seguranca-relacional": clampScore(baseScores["seguranca-relacional"] + Math.round((Math.random() - 0.5) * 22)),
      };
      const flags: string[] = [];

      if (scores.recarga < 40) {
        flags.push("workload");
      }
      if (scores["seguranca-relacional"] < 45) {
        flags.push("climate_risk");
      }
      if (scores["seguranca-relacional"] < 30) {
        flags.push("harassment_signal");
      }

      const checkIn: CheckIn = {
        id: randomUUID(),
        userId,
        answers: buildSeedAnswers(scores, flags),
        domainScores: JSON.stringify(scores),
        flags: flags.length > 0 ? flags : null,
        chatTriggered: flags.includes("harassment_signal"),
        confidence: null,
        abandonedAtQuestion: null,
        createdAt: date,
      };

      this.checkIns.set(checkIn.id, checkIn);
    };

    const demoUser: User = {
      id: "user-1",
      username: "maria@lumina.com",
      password: seedHash,
      name: "Maria Silva",
      role: "collaborator",
      department: "Marketing",
    };
    this.users.set(demoUser.id, demoUser);

    const rhUser: User = {
      id: "user-rh",
      username: "rh@lumina.com",
      password: seedHash,
      name: "Carlos Mendes",
      role: "rh",
      department: "Recursos Humanos",
    };
    this.users.set(rhUser.id, rhUser);

    const rhMembership: TenantMembership = {
      userId: rhUser.id,
      tenantId: defaultTenant.id,
      membershipRole: "tenant_admin",
      capabilities: getDefaultTenantCapabilities("tenant_admin"),
      active: true,
      createdAt: devNow(),
      updatedAt: devNow(),
    };
    this.tenantMembershipsMap.set(this.tenantMembershipKey(rhMembership.userId, rhMembership.tenantId), rhMembership);

    const demoMembership: TenantMembership = {
      userId: demoUser.id,
      tenantId: defaultTenant.id,
      membershipRole: "tenant_viewer",
      capabilities: getDefaultTenantCapabilities("tenant_viewer"),
      active: true,
      createdAt: devNow(),
      updatedAt: devNow(),
    };
    this.tenantMembershipsMap.set(this.tenantMembershipKey(demoMembership.userId, demoMembership.tenantId), demoMembership);

    const departments = ["Vendas", "TI", "Marketing", "Financeiro", "Operações"];

    for (let i = 0; i < 50; i++) {
      const dept = departments[i % departments.length];
      const seedUser: User = {
        id: `seed-user-${i}`,
        username: `user${i}@lumina.com`,
        password: seedHash,
        name: `Colaborador ${i + 1}`,
        role: "collaborator",
        department: dept,
      };
      this.users.set(seedUser.id, seedUser);

      for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
        const checksInMonth = 1 + (i + monthOffset) % 3;
        for (let j = 0; j < checksInMonth; j++) {
          const date = devNow();
          date.setMonth(date.getMonth() - monthOffset);
          date.setDate(3 + ((i * 7 + j * 9) % 24));
          createSeedCheckIn(seedUser.id, date, departmentProfiles[dept]);
        }
      }
    }

    const demoOffsets = [1, 3, 6, 10, 16, 24, 36, 52, 79, 104, 128, 151];
    const demoProfiles = [
      { recarga: 78, "estado-do-dia": 74, "seguranca-relacional": 82 },
      { recarga: 61, "estado-do-dia": 58, "seguranca-relacional": 66 },
      { recarga: 48, "estado-do-dia": 52, "seguranca-relacional": 58 },
      { recarga: 40, "estado-do-dia": 45, "seguranca-relacional": 34 },
    ];

    demoOffsets.forEach((daysAgo, index) => {
      const date = devNow();
      date.setDate(date.getDate() - daysAgo);
      createSeedCheckIn("user-1", date, demoProfiles[index % demoProfiles.length]);
    });
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllTenantPlans(): Promise<TenantPlan[]> {
    return Array.from(this.tenantPlansMap.values()).toSorted((left, right) => left.name.localeCompare(right.name));
  }

  async getTenantPlan(id: string): Promise<TenantPlan | undefined> {
    return this.tenantPlansMap.get(id);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenantsMap.values()).toSorted((left, right) => left.name.localeCompare(right.name));
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.tenantsMap.get(id);
  }

  async getAllTenantMemberships(): Promise<TenantMembership[]> {
    return Array.from(this.tenantMembershipsMap.values()).toSorted((left, right) => {
      const tenantSort = left.tenantId.localeCompare(right.tenantId);
      if (tenantSort === 0) {
        return left.userId.localeCompare(right.userId);
      }
      return tenantSort;
    });
  }

  async getTenantMembershipsByUserId(userId: string): Promise<TenantMembership[]> {
    return Array.from(this.tenantMembershipsMap.values())
      .filter((membership) => membership.userId === userId)
      .toSorted((left, right) => left.tenantId.localeCompare(right.tenantId));
  }

  async createTenantPlan(insertPlan: InsertTenantPlan): Promise<TenantPlan> {
    const id = randomUUID();
    const plan: TenantPlan = {
      id,
      code: insertPlan.code,
      name: insertPlan.name,
      audience: insertPlan.audience,
      description: insertPlan.description,
      isolationProfile: insertPlan.isolationProfile,
      monthlyActiveUserLimit: insertPlan.monthlyActiveUserLimit ?? null,
      priceMonthlyUsdCents: insertPlan.priceMonthlyUsdCents ?? null,
      billingCycle: insertPlan.billingCycle ?? null,
      active: insertPlan.active ?? true,
      createdAt: devNow(),
    };
    this.tenantPlansMap.set(id, plan);
    return plan;
  }

  async updateTenantPlan(id: string, updates: UpdateTenantPlan): Promise<TenantPlan | undefined> {
    const existing = this.tenantPlansMap.get(id);
    if (!existing) return undefined;
    const updated: TenantPlan = {
      ...existing,
      ...updates,
    };
    this.tenantPlansMap.set(id, updated);
    return updated;
  }

  async getTenantBillingPeriods(tenantId: string): Promise<BillingPeriod[]> {
    return Array.from(this.billingPeriodsMap.values())
      .filter((bp) => bp.tenantId === tenantId)
      .toSorted((a, b) => b.periodStart.localeCompare(a.periodStart)); // newest first
  }

  async getActiveBillingPeriod(tenantId: string): Promise<BillingPeriod | undefined> {
    return Array.from(this.billingPeriodsMap.values()).find(
      (bp) => bp.tenantId === tenantId && bp.status === "active",
    );
  }

  async createBillingPeriod(data: CreateBillingPeriod): Promise<BillingPeriod> {
    const id = randomUUID();
    const now = devNow();
    const period: BillingPeriod = {
      id,
      tenantId: data.tenantId,
      planCode: data.planCode,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      mauLimit: data.mauLimit ?? null,
      mauUsed: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.billingPeriodsMap.set(id, period);
    return period;
  }

  async updateBillingPeriodUsage(id: string, updates: UpdateBillingPeriodUsage): Promise<BillingPeriod | undefined> {
    const existing = this.billingPeriodsMap.get(id);
    if (!existing) return undefined;
    const updated: BillingPeriod = {
      ...existing,
      mauUsed: updates.mauUsed,
      status: updates.status ?? existing.status,
      updatedAt: devNow(),
    };
    this.billingPeriodsMap.set(id, updated);
    return updated;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const id = randomUUID();
    const tenant: Tenant = {
      id,
      slug: insertTenant.slug,
      name: insertTenant.name,
      audience: insertTenant.audience,
      planCode: insertTenant.planCode,
      status: insertTenant.status ?? "draft",
      billingEmail: insertTenant.billingEmail ?? null,
      dataResidency: insertTenant.dataResidency ?? null,
      createdAt: devNow(),
      updatedAt: devNow(),
    };
    this.tenantsMap.set(id, tenant);
    return tenant;
  }

  async upsertTenantMembership(membership: CreateTenantMembership): Promise<TenantMembership> {
    const key = this.tenantMembershipKey(membership.userId, membership.tenantId);
    const existing = this.tenantMembershipsMap.get(key);
    const now = devNow();
    const nextMembership: TenantMembership = {
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipRole: membership.membershipRole,
      capabilities: getDefaultTenantCapabilities(membership.membershipRole),
      active: membership.active,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.tenantMembershipsMap.set(key, nextMembership);
    return nextMembership;
  }

  async updateTenantMembership(userId: string, tenantId: string, updates: UpdateTenantMembership): Promise<TenantMembership | undefined> {
    const key = this.tenantMembershipKey(userId, tenantId);
    const existing = this.tenantMembershipsMap.get(key);
    if (!existing) return undefined;
    const membershipRole = updates.membershipRole ?? existing.membershipRole;
    const updated: TenantMembership = {
      ...existing,
      ...updates,
      membershipRole,
      capabilities: getDefaultTenantCapabilities(membershipRole),
      updatedAt: devNow(),
    };
    this.tenantMembershipsMap.set(key, updated);
    return updated;
  }

  async updateTenant(id: string, updates: UpdateTenant): Promise<Tenant | undefined> {
    const existing = this.tenantsMap.get(id);
    if (!existing) return undefined;
    const updated: Tenant = {
      ...existing,
      ...updates,
      updatedAt: devNow(),
    };
    this.tenantsMap.set(id, updated);
    return updated;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const user: User = { ...insertUser, id, password: hashedPassword, role: insertUser.role || "collaborator", department: insertUser.department || null };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error("Usuário não encontrado");
    const hashed = await bcrypt.hash(newPassword, 10);
    this.users.set(userId, { ...user, password: hashed });
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const id = randomUUID();
    const checkIn: CheckIn = {
      ...insertCheckIn,
      id,
      createdAt: devNow(),
      flags: insertCheckIn.flags || null,
      chatTriggered: insertCheckIn.chatTriggered ?? false,
      confidence: insertCheckIn.confidence ?? null,
      abandonedAtQuestion: insertCheckIn.abandonedAtQuestion ?? null,
    };
    this.checkIns.set(id, checkIn);
    return checkIn;
  }

  async getCheckInsByUserId(userId: string): Promise<CheckIn[]> {
    return Array.from(this.checkIns.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getCheckInsByUserIdAndDate(userId: string, date: Date): Promise<CheckIn[]> {
    return Array.from(this.checkIns.values())
      .filter((checkIn) => checkIn.userId === userId && isSameDay(checkIn.createdAt, date))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllCheckIns(): Promise<CheckIn[]> {
    return Array.from(this.checkIns.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getRhAggregate(): Promise<RHAggregateData> {
    const collaborators = Array.from(this.users.values()).filter((user) => user.role === "collaborator");
    const allCheckIns = await this.getAllCheckIns();
    const now = devNow();
    const days30Ago = new Date(now);
    days30Ago.setDate(now.getDate() - 30);
    const days14Ago = new Date(now);
    days14Ago.setDate(now.getDate() - 14);

    const recent30 = allCheckIns.filter((checkIn) => (checkIn.createdAt?.getTime() || 0) >= days30Ago.getTime());
    const recent14 = allCheckIns.filter((checkIn) => (checkIn.createdAt?.getTime() || 0) >= days14Ago.getTime());
    const activeCollaborators = new Set(recent30.map((checkIn) => checkIn.userId)).size;

    const departments = Array.from(
      collaborators.reduce((map, user) => {
        const department = user.department ?? "Sem área";
        const users = map.get(department) ?? [];
        users.push(user);
        map.set(department, users);
        return map;
      }, new Map<string, User[]>()),
    )
      .map(([department, departmentUsers]) => {
        const userIds = new Set(departmentUsers.map((user) => user.id));
        const departmentRecords30 = recent30.filter((checkIn) => userIds.has(checkIn.userId));
        const departmentRecords14 = recent14.filter((checkIn) => userIds.has(checkIn.userId));
        const participationRate = clampScore((new Set(departmentRecords30.map((checkIn) => checkIn.userId)).size / Math.max(1, departmentUsers.length)) * 100);

        const domainAverages = (Object.keys(DOMAIN_LABELS) as ScoreDomainId[]).map((domain) => ({
          domain,
          label: DOMAIN_LABELS[domain],
          avg: average(departmentRecords14.map((checkIn) => parseDomainScores(checkIn.domainScores)[domain])),
        }));

        const stressIndex = clampScore(100 - average(departmentRecords14.map((checkIn) => average([
          parseDomainScores(checkIn.domainScores).recarga,
          parseDomainScores(checkIn.domainScores)["estado-do-dia"],
        ]))));
        const burnoutIndex = clampScore(100 - average(departmentRecords14.map((checkIn) => average([
          parseDomainScores(checkIn.domainScores).recarga,
          parseDomainScores(checkIn.domainScores)["seguranca-relacional"],
        ]))));
        const riskLevel = getRiskLevel(stressIndex, burnoutIndex);

        return {
          department,
          headcount: departmentUsers.length,
          participationRate,
          domainAverages,
          riskLevel,
          stressIndex,
          burnoutIndex,
        } satisfies DeptAggregate;
      })
      .filter((dept) => dept.headcount >= ANONYMITY_THRESHOLD)
      .toSorted((left, right) => right.burnoutIndex - left.burnoutIndex);

    const averageWellbeing = average(
      recent14.map((checkIn) => average(Object.values(parseDomainScores(checkIn.domainScores)))),
    );

    const alerts = departments
      .filter((department) => department.riskLevel !== "low")
      .slice(0, 3)
      .map((department, index) => ({
        id: `alert-${index + 1}`,
        severity: getAlertSeverity(department.riskLevel),
        title:
          department.riskLevel === "high"
            ? "Área com sinal agregado elevado"
            : "Área em atenção recente",
        description:
          department.riskLevel === "high"
            ? `${department.department} apresenta proxy agregado de desgaste em ${department.burnoutIndex}% e segurança relacional recente de ${department.domainAverages.find((item) => item.domain === "seguranca-relacional")?.avg ?? 0}%.`
            : `${department.department} registra proxy agregado de estresse em ${department.stressIndex}% com participação de ${department.participationRate}% nos últimos 30 dias.`,
        department: department.department,
        timestamp: "agora",
      } satisfies AggregateAlert));

    const actualMonths = Array.from({ length: 6 }, (_, index) => addMonths(new Date(now.getFullYear(), now.getMonth(), 1), index - 5));
    const actualTrend = actualMonths.map((monthDate) => {
      const monthKey = getMonthKey(monthDate);
      const monthRecords = allCheckIns.filter((checkIn) => {
        if (!(checkIn.createdAt instanceof Date)) {
          return false;
        }
        return getMonthKey(checkIn.createdAt) === monthKey;
      });

      return {
        month: getMonthLabel(monthDate),
        value: monthRecords.length > 0
          ? clampScore(100 - average(monthRecords.map((checkIn) => average([
              parseDomainScores(checkIn.domainScores).recarga,
              parseDomainScores(checkIn.domainScores)["seguranca-relacional"],
            ]))))
          : null,
      };
    });

    const actualValues = actualTrend.map((point) => point.value).filter((value): value is number => value !== null);
    const avgDelta = actualValues.length >= 2
      ? arithmeticMean(actualValues.slice(1).map((value, index) => value - actualValues[index]))
      : 3;
    const lastActualValue = actualValues.at(-1) ?? 45;
    const forecastTrend = Array.from({ length: 3 }, (_, index) => ({
      month: getMonthLabel(addMonths(actualMonths.at(-1) ?? now, index + 1)),
      forecast: clampScore(lastActualValue + avgDelta * (index + 1)),
    }));

    const trendBurnout: TrendPoint[] = [
      ...actualTrend.map((point) => ({ month: point.month, value: point.value, forecast: null })),
      ...forecastTrend.map((point) => ({ month: point.month, value: null, forecast: point.forecast })),
    ];

    const latestByUser = recent30.reduce((map, checkIn) => {
      const existing = map.get(checkIn.userId);
      const existingTime = existing?.createdAt?.getTime() ?? 0;
      const currentTime = checkIn.createdAt?.getTime() ?? 0;
      if (currentTime > existingTime) {
        map.set(checkIn.userId, checkIn);
      }
      return map;
    }, new Map<string, CheckIn>());

    const moodCounts = Array.from(latestByUser.values()).reduce((counts, checkIn) => {
      const category = categorizeMood(checkIn);
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const totalMoodBase = Math.max(1, Array.from(latestByUser.values()).length);
    const moodPalette: Record<string, string> = {
      Bem: "#34d399",
      Ansioso: "#f87171",
      Calmo: "#22d3ee",
      Tenso: "#fb923c",
      Outros: "#94a3b8",
    };
    const moodDistribution = Object.entries(moodCounts)
      .map(([name, count]) => ({
        name,
        value: clampScore((count / totalMoodBase) * 100),
        color: moodPalette[name] ?? moodPalette.Outros,
      }))
      .toSorted((left, right) => right.value - left.value);

    return {
      departments,
      alerts,
      participation: clampScore((activeCollaborators / Math.max(1, collaborators.length)) * 100),
      totalCollaborators: collaborators.length,
      activeCollaborators,
      averageWellbeing,
      trendBurnout,
      moodDistribution,
    };
  }

  async createMomentCheckIn(insert: InsertMomentCheckIn): Promise<MomentCheckIn> {
    const id = randomUUID();
    const checkIn: MomentCheckIn = {
      ...insert,
      id,
      createdAt: devNow(),
      flags: insert.flags || null,
      chatTriggered: insert.chatTriggered ?? false,
    };
    this.momentCheckIns.set(id, checkIn);
    return checkIn;
  }

  async getMomentCheckInsByUserId(userId: string): Promise<MomentCheckIn[]> {
    return Array.from(this.momentCheckIns.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getMomentCheckInsByUserIdAndDate(userId: string, date: Date): Promise<MomentCheckIn[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return Array.from(this.momentCheckIns.values())
      .filter((c) => {
        if (c.userId !== userId) return false;
        const t = c.createdAt?.getTime() || 0;
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      })
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllMomentCheckIns(): Promise<MomentCheckIn[]> {
    return Array.from(this.momentCheckIns.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createIncidentReport(insertReport: InsertIncidentReport): Promise<IncidentReport> {
    const id = randomUUID();
    const report: IncidentReport = {
      ...insertReport,
      id,
      createdAt: devNow(),
      userId: insertReport.userId || null,
      description: insertReport.description || null,
      anonymous: insertReport.anonymous ?? true,
      reportMode: insertReport.reportMode ?? "anonymous",
      severity: insertReport.severity || null,
      occurrenceWindow: insertReport.occurrenceWindow || null,
      location: insertReport.location || null,
      peopleInvolved: insertReport.peopleInvolved || null,
      followUpRequested: insertReport.followUpRequested ?? false,
    };
    this.incidentReports.set(id, report);
    return report;
  }

  async getAllIncidentReports(): Promise<IncidentReport[]> {
    return Array.from(this.incidentReports.values());
  }

  async getDailyMissions(userId: string, isoDate: string): Promise<UserMission[]> {
    return Array.from(this.userMissionsMap.values()).filter(
      (m) => m.userId === userId && m.date === isoDate,
    );
  }

  async completeMission(insert: InsertUserMission): Promise<UserMission> {
    const id = randomUUID();
    const mission: UserMission = { ...insert, id, completedAt: devNow() };
    this.userMissionsMap.set(id, mission);
    return mission;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.userSettingsMap.get(userId);
  }

  async upsertUserSettings(userId: string, settingsJson: string): Promise<UserSettings> {
    const record: UserSettings = { userId, settings: settingsJson, updatedAt: devNow() };
    this.userSettingsMap.set(userId, record);
    return record;
  }

  async createSolarPointEntry(entry: InsertSolarPoints): Promise<SolarPoints> {
    const id = randomUUID();
    const record: SolarPoints = {
      ...entry,
      id,
      createdAt: devNow(),
    };
    this.solarPointsMap.set(id, record);
    return record;
  }

  async getSolarPointsByUserId(userId: string): Promise<SolarPoints[]> {
    return Array.from(this.solarPointsMap.values())
      .filter((e) => e.userId === userId)
      .toSorted((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async createPulseResponse(insert: InsertPulseResponse): Promise<PulseResponse> {
    const id = randomUUID();
    const response: PulseResponse = {
      ...insert,
      id,
      submittedAt: devNow(),
    };
    this.pulseResponsesMap.set(id, response);
    return response;
  }

  async getPulseResponsesByUserId(userId: string, pulseKey?: string): Promise<PulseResponse[]> {
    return Array.from(this.pulseResponsesMap.values())
      .filter((response) => response.userId === userId && (pulseKey === undefined || response.pulseKey === pulseKey))
      .toSorted((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0));
  }

  async getLatestPulseResponseByUserId(userId: string, pulseKey: string): Promise<PulseResponse | undefined> {
    return (await this.getPulseResponsesByUserId(userId, pulseKey)).at(0);
  }

  async getRhPulseAggregate(): Promise<RhPulseAggregate> {
    const now = devNow();
    const windowStart = new Date(now);
    windowStart.setDate(now.getDate() - PULSE_SURVEY_INTERVAL_DAYS);

    const prevWindowStart = new Date(windowStart);
    prevWindowStart.setDate(windowStart.getDate() - PULSE_SURVEY_INTERVAL_DAYS);

    const allResponses = Array.from(this.pulseResponsesMap.values());

    const currentResponses = allResponses.filter((r) => {
      const ts = r.submittedAt?.getTime() ?? 0;
      return ts >= windowStart.getTime() && ts <= now.getTime();
    });

    const prevResponses = allResponses.filter((r) => {
      const ts = r.submittedAt?.getTime() ?? 0;
      return ts >= prevWindowStart.getTime() && ts < windowStart.getTime();
    });

    const totalCollaborators = Array.from(this.users.values()).filter((u) => u.role === "collaborator").length;
    const respondentCount = new Set(currentResponses.map((r) => r.userId)).size;
    const participationRate = totalCollaborators === 0 ? 0 : Math.round((respondentCount / totalCollaborators) * 100);
    const eligible = respondentCount >= ANONYMITY_THRESHOLD;

    const windowDates = currentResponses.map((r) => r.submittedAt?.toISOString().slice(0, 10) ?? "");
    const windowStartIso = windowDates.length > 0 ? [...windowDates].toSorted()[0] : windowStart.toISOString().slice(0, 10);
    const windowEndIso = windowDates.length > 0 ? [...windowDates].toSorted().at(-1) ?? windowStartIso : now.toISOString().slice(0, 10);

    function aggregateDimensions(responses: PulseResponse[]): { overall: number; dims: RhPulseDimensionScores } | null {
      if (responses.length === 0) return null;
      const dimBuckets: Record<PulseDimension, number[]> = {
        pressure_predictability: [],
        support_care: [],
        peer_relations: [],
        role_clarity: [],
      };
      for (const resp of responses) {
        const summary = parsePulseScoreSummary(resp.scoreSummary);
        if (!summary) continue;
        for (const [dim, score] of Object.entries(summary.dimensionScores) as [PulseDimension, number][]) {
          dimBuckets[dim].push(score);
        }
      }
      const dims: RhPulseDimensionScores = {
        pressure_predictability: dimBuckets.pressure_predictability.length > 0 ? Math.round(dimBuckets.pressure_predictability.reduce((s, v) => s + v, 0) / dimBuckets.pressure_predictability.length) : null,
        support_care: dimBuckets.support_care.length > 0 ? Math.round(dimBuckets.support_care.reduce((s, v) => s + v, 0) / dimBuckets.support_care.length) : null,
        peer_relations: dimBuckets.peer_relations.length > 0 ? Math.round(dimBuckets.peer_relations.reduce((s, v) => s + v, 0) / dimBuckets.peer_relations.length) : null,
        role_clarity: dimBuckets.role_clarity.length > 0 ? Math.round(dimBuckets.role_clarity.reduce((s, v) => s + v, 0) / dimBuckets.role_clarity.length) : null,
      };
      const validScores = Object.values(dims).filter((v): v is number => v !== null);
      const overall = validScores.length > 0 ? Math.round(validScores.reduce((s, v) => s + v, 0) / validScores.length) : 0;
      return { overall, dims };
    }

    const currentAgg = eligible ? aggregateDimensions(currentResponses) : null;
    const prevRespondentCount = new Set(prevResponses.map((r) => r.userId)).size;
    const prevAgg = prevRespondentCount >= ANONYMITY_THRESHOLD ? aggregateDimensions(prevResponses) : null;

    const overallScore = currentAgg?.overall ?? null;
    const previousOverallScore = prevAgg?.overall ?? null;
    const trendDelta = overallScore !== null && previousOverallScore !== null ? overallScore - previousOverallScore : null;

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
      trendDelta,
    };
  }

  async createTeamContribution(data: InsertTeamChallengeContribution): Promise<TeamChallengeContribution> {
    const id = randomUUID();
    const record: TeamChallengeContribution = { ...data, id, amount: data.amount ?? 1, createdAt: devNow() };
    this.teamContributionsMap.set(id, record);
    return record;
  }

  async getTeamContributionsByChallengeAndMonth(challengeId: string, startDate: string, endDate: string): Promise<TeamChallengeContribution[]> {
    return Array.from(this.teamContributionsMap.values()).filter(
      (c) => c.challengeId === challengeId && c.date >= startDate && c.date <= endDate,
    );
  }

  async getUserTodayTeamContributions(userId: string, challengeId: string, date: string): Promise<TeamChallengeContribution[]> {
    return Array.from(this.teamContributionsMap.values()).filter(
      (c) => c.userId === userId && c.challengeId === challengeId && c.date === date,
    );
  }

  async createCommunityMessage(insert: InsertCommunityMessage): Promise<CommunityMessage> {
    const id = randomUUID();
    const msg: CommunityMessage = {
      ...insert,
      id,
      isAnonymous: insert.isAnonymous ?? true,
      authorName: insert.authorName ?? null,
      content: insert.content ?? null,
      audioUrl: insert.audioUrl ?? null,
      mediaType: insert.mediaType ?? "text",
      category: insert.category ?? null,
      likeCount: 0,
      createdAt: devNow(),
    };
    this.communityMessagesMap.set(id, msg);
    return msg;
  }

  async getCommunityMessages(limit: number, offset: number): Promise<CommunityMessage[]> {
    return Array.from(this.communityMessagesMap.values())
      .toSorted((a, b) => {
        const likeDiff = b.likeCount - a.likeCount;
        if (likeDiff !== 0) return likeDiff;
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      })
      .slice(offset, offset + limit);
  }

  async getCommunityMessageById(id: string): Promise<CommunityMessage | undefined> {
    return this.communityMessagesMap.get(id);
  }

  async toggleMessageLike(messageId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const compositeKey = `${messageId}:${userId}`;
    const existing = this.messageLikesMap.get(compositeKey);
    const msg = this.communityMessagesMap.get(messageId);
    if (!msg) throw new Error("Mensagem não encontrada");

    if (existing) {
      this.messageLikesMap.delete(compositeKey);
      msg.likeCount = Math.max(0, msg.likeCount - 1);
      return { liked: false, likeCount: msg.likeCount };
    }

    const like: MessageLike = { messageId, userId, createdAt: devNow() };
    this.messageLikesMap.set(compositeKey, like);
    msg.likeCount += 1;
    return { liked: true, likeCount: msg.likeCount };
  }

  async getUserLikedMessageIds(userId: string): Promise<string[]> {
    return Array.from(this.messageLikesMap.values())
      .filter((l) => l.userId === userId)
      .map((l) => l.messageId);
  }

  private deleteChatDataForUser(userId: string): void {
    const convIds: string[] = [];
    for (const [id, conv] of this.chatConversationsMap) {
      if (conv.userId === userId) convIds.push(id);
    }
    for (const cid of convIds) {
      this.chatConversationsMap.delete(cid);
      for (const [mid, msg] of this.chatMessagesMap) {
        if (msg.conversationId === cid) this.chatMessagesMap.delete(mid);
      }
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    this.deleteChatDataForUser(userId);
    this.users.delete(userId);
    this.removeEntriesForUser(this.checkIns, userId);
    this.removeEntriesForUser(this.momentCheckIns, userId);
    this.removeEntriesForUser(this.userMissionsMap, userId);
    this.removeEntriesForUser(this.solarPointsMap, userId);
    this.removeEntriesForUser(this.pulseResponsesMap, userId);
    this.userSettingsMap.delete(userId);
    this.removeEntriesForUser(this.incidentReports, userId);
    this.removeEntriesForUser(this.teamContributionsMap, userId);
    this.removeEntriesForUser(this.communityMessagesMap, userId);
  }

  async resetUserActivity(userId: string): Promise<void> {
    this.deleteChatDataForUser(userId);
    this.removeEntriesForUser(this.checkIns, userId);
    this.removeEntriesForUser(this.momentCheckIns, userId);
    this.removeEntriesForUser(this.userMissionsMap, userId);
    this.removeEntriesForUser(this.solarPointsMap, userId);
    this.removeEntriesForUser(this.pulseResponsesMap, userId);
    this.removeEntriesForUser(this.incidentReports, userId);
    this.removeEntriesForUser(this.teamContributionsMap, userId);
    this.removeEntriesForUser(this.communityMessagesMap, userId);
  }

  async createChatConversation(conv: InsertChatConversation): Promise<ChatConversation> {
    const id = randomUUID();
    const now = new Date();
    const record: ChatConversation = {
      id,
      userId: conv.userId,
      title: conv.title ?? null,
      orchestratorSessionId: conv.orchestratorSessionId ?? null,
      orchestratorConversationId: conv.orchestratorConversationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.chatConversationsMap.set(id, record);
    return record;
  }

  async updateChatConversation(id: string, updates: Partial<Pick<ChatConversation, "title" | "orchestratorSessionId" | "orchestratorConversationId">>): Promise<ChatConversation | undefined> {
    const existing = this.chatConversationsMap.get(id);
    if (!existing) return undefined;
    const updated: ChatConversation = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.chatConversationsMap.set(id, updated);
    return updated;
  }

  async getChatConversationsByUserId(userId: string): Promise<ChatConversation[]> {
    return Array.from(this.chatConversationsMap.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  }

  async getChatConversation(id: string): Promise<ChatConversation | undefined> {
    return this.chatConversationsMap.get(id);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const record: ChatMessage = {
      id,
      conversationId: msg.conversationId,
      role: msg.role,
      content: msg.content,
      createdAt: new Date(),
    };
    this.chatMessagesMap.set(id, record);
    return record;
  }

  async getChatMessagesByConversationId(conversationId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessagesMap.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }
}


