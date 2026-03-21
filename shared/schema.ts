import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const billingCycleSchema = z.enum(["monthly", "annual"]);
const billingPeriodStatusSchema = z.enum(["active", "closed", "overdue"]);
const incidentReportModeSchema = z.enum(["anonymous", "formal"]);
const incidentOccurrenceWindowSchema = z.enum(["today", "this_week", "this_month", "older"]);
const incidentSeveritySchema = z.enum(["low", "moderate", "high", "emergency"]);
const tenantAudienceSchema = z.enum(["btc", "btb", "btg"]);
const tenantStatusSchema = z.enum(["active", "suspended", "draft"]);
const tenantMembershipRoleSchema = z.enum(["tenant_admin", "tenant_analyst", "tenant_viewer"]);
const tenantCapabilitySchema = z.enum([
  "control_plane:read",
  "control_plane:write",
  "tenant_memberships:write",
]);

export const TENANT_ROLE_CAPABILITIES = {
  tenant_admin: ["control_plane:read", "control_plane:write", "tenant_memberships:write"],
  tenant_analyst: ["control_plane:read"],
  tenant_viewer: ["control_plane:read"],
} as const satisfies Record<z.infer<typeof tenantMembershipRoleSchema>, readonly z.infer<typeof tenantCapabilitySchema>[]>;

export function parseTenantMembershipRole(role: string): z.infer<typeof tenantMembershipRoleSchema> {
  return tenantMembershipRoleSchema.parse(role);
}

export function getDefaultTenantCapabilities(role: string): string[] {
  return [...TENANT_ROLE_CAPABILITIES[parseTenantMembershipRole(role)]];
}

export const tenantPlans = pgTable("tenant_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  description: text("description").notNull(),
  isolationProfile: text("isolation_profile").notNull(),
  monthlyActiveUserLimit: integer("monthly_active_user_limit"),
  // Billing metadata — null means custom/enterprise-negotiated contract
  priceMonthlyUsdCents: integer("price_monthly_usd_cents"),
  billingCycle: text("billing_cycle"), // "monthly" | "annual" | null
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tracks contracted billing windows and MAU consumption per tenant.
// One active row per tenant; closed when period ends or plan changes.
export const billingPeriods = pgTable("billing_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  planCode: text("plan_code").notNull(),
  periodStart: text("period_start").notNull(), // ISO "YYYY-MM-DD"
  periodEnd: text("period_end").notNull(),    // ISO "YYYY-MM-DD"
  mauLimit: integer("mau_limit"),             // null = unlimited per contract
  mauUsed: integer("mau_used").notNull().default(0),
  status: text("status").notNull().default("active"), // active | closed | overdue
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  planCode: text("plan_code").notNull(),
  status: text("status").notNull().default("draft"),
  billingEmail: text("billing_email"),
  dataResidency: text("data_residency"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("collaborator"),
  department: text("department"),
});

export const tenantMemberships = pgTable("tenant_memberships", {
  userId: varchar("user_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  membershipRole: text("membership_role").notNull(),
  capabilities: text("capabilities").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.tenantId] }),
]);

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  answers: text("answers").notNull(),
  domainScores: text("domain_scores").notNull(),
  flags: text("flags").array(),
  chatTriggered: boolean("chat_triggered").default(false),
  /** Number of questions answered out of total (e.g. 5 of 6). */
  confidence: real("confidence"),
  /** If abandoned mid-flow, which question index they stopped at. */
  abandonedAtQuestion: integer("abandoned_at_question"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Legacy 3-moment EMA check-in kept for compatibility while historical data is migrated.
export const momentCheckIns = pgTable("moment_check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  moment: text("moment").notNull(), // "morning" | "midday" | "endday"
  answers: text("answers").notNull(), // JSON string: Record<stepId, selectedOptionId | selectedOptionIds[]>
  scores: text("scores").notNull(), // JSON string: Record<stepId, number>
  flags: text("flags").array(), // Aggregated risk flags from all answers
  chatTriggered: boolean("chat_triggered").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const incidentReports = pgTable("incident_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  description: text("description"),
  anonymous: boolean("anonymous").default(true),
  reportMode: text("report_mode").notNull().default("anonymous"),
  severity: text("severity"),
  occurrenceWindow: text("occurrence_window"),
  location: text("location"),
  peopleInvolved: text("people_involved"),
  followUpRequested: boolean("follow_up_requested").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userMissions = pgTable("user_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  missionId: text("mission_id").notNull(),
  date: text("date").notNull(), // ISO date "YYYY-MM-DD"
  pointsEarned: integer("points_earned").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey(),
  settings: text("settings").notNull(), // JSON string of AppSettings
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Solar points (engagement rewards) ─────────────

export const solarPoints = pgTable("solar_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  points: integer("points").notNull(),
  date: text("date").notNull(), // ISO "YYYY-MM-DD"
  createdAt: timestamp("created_at").defaultNow(),
});

export const solarStreaks = pgTable("solar_streaks", {
  userId: varchar("user_id").primaryKey(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastCheckinDate: text("last_checkin_date"),
  frozen: boolean("frozen").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Team challenges ───────────────────────────────

export const teamChallengeContributions = pgTable("team_challenge_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  challengeId: text("challenge_id").notNull(),
  amount: integer("amount").notNull().default(1),
  /** ISO date "YYYY-MM-DD" — workday of contribution */
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pulseResponses = pgTable("pulse_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  pulseKey: text("pulse_key").notNull(),
  pulseVersion: integer("pulse_version").notNull(),
  windowStart: text("window_start").notNull(),
  windowEnd: text("window_end").notNull(),
  answers: text("answers").notNull(),
  scoreSummary: text("score_summary").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const communityMessages = pgTable("community_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  authorName: text("author_name"),
  isAnonymous: boolean("is_anonymous").notNull().default(true),
  content: text("content"),
  audioUrl: text("audio_url"),
  mediaType: text("media_type").notNull().default("text"),
  category: text("category"),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageLikes = pgTable("message_likes", {
  messageId: varchar("message_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.userId] }),
]);

// ── Chat conversations & messages ────────────────

export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title"),
  orchestratorSessionId: text("orchestrator_session_id"),
  orchestratorConversationId: text("orchestrator_conversation_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Insert schemas ────────────────────────────────

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  department: true,
});

export const insertTenantPlanSchema = createInsertSchema(tenantPlans).pick({
  code: true,
  name: true,
  audience: true,
  description: true,
  isolationProfile: true,
  monthlyActiveUserLimit: true,
  priceMonthlyUsdCents: true,
  billingCycle: true,
  active: true,
});

export const insertTenantSchema = createInsertSchema(tenants).pick({
  slug: true,
  name: true,
  audience: true,
  planCode: true,
  status: true,
  billingEmail: true,
  dataResidency: true,
});

export const insertTenantMembershipSchema = createInsertSchema(tenantMemberships).pick({
  userId: true,
  tenantId: true,
  membershipRole: true,
  capabilities: true,
  active: true,
});

export const createTenantSchema = z.object({
  slug: z.string().trim().min(3).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(3).max(120),
  audience: tenantAudienceSchema,
  planCode: z.string().trim().min(2).max(40),
  status: tenantStatusSchema.default("draft"),
  billingEmail: z.string().email().max(254).nullable().optional(),
  dataResidency: z.string().trim().max(80).nullable().optional(),
});

export const createTenantPlanSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(3).max(120),
  audience: tenantAudienceSchema,
  description: z.string().trim().min(12).max(400),
  isolationProfile: z.string().trim().min(3).max(80),
  monthlyActiveUserLimit: z.number().int().positive().nullable().optional(),
  priceMonthlyUsdCents: z.number().int().nonnegative().nullable().optional(),
  billingCycle: billingCycleSchema.nullable().optional(),
  active: z.boolean().default(true),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  planCode: z.string().trim().min(2).max(40).optional(),
  status: tenantStatusSchema.optional(),
  billingEmail: z.string().email().max(254).nullable().optional(),
  dataResidency: z.string().trim().max(80).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Informe pelo menos um campo para atualização",
});

export const updateTenantPlanSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(12).max(400).optional(),
  isolationProfile: z.string().trim().min(3).max(80).optional(),
  monthlyActiveUserLimit: z.number().int().positive().nullable().optional(),
  priceMonthlyUsdCents: z.number().int().nonnegative().nullable().optional(),
  billingCycle: billingCycleSchema.nullable().optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Informe pelo menos um campo para atualização",
});

export const createBillingPeriodSchema = z.object({
  tenantId: z.string().trim().min(1),
  planCode: z.string().trim().min(2).max(40),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  mauLimit: z.number().int().positive().nullable().optional(),
}).refine((d) => d.periodEnd > d.periodStart, {
  message: "periodEnd deve ser posterior a periodStart",
  path: ["periodEnd"],
});

export const updateBillingPeriodUsageSchema = z.object({
  mauUsed: z.number().int().min(0),
  status: billingPeriodStatusSchema.optional(),
});

export const createTenantMembershipSchema = z.object({
  userId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  membershipRole: tenantMembershipRoleSchema,
  active: z.boolean().default(true),
});

export const updateTenantMembershipSchema = z.object({
  membershipRole: tenantMembershipRoleSchema.optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Informe pelo menos um campo para atualização",
});

export const insertCheckInSchema = createInsertSchema(checkIns).pick({
  userId: true,
  answers: true,
  domainScores: true,
  flags: true,
  chatTriggered: true,
  confidence: true,
  abandonedAtQuestion: true,
});

export const insertMomentCheckInSchema = createInsertSchema(momentCheckIns).pick({
  userId: true,
  moment: true,
  answers: true,
  scores: true,
  flags: true,
  chatTriggered: true,
});

export const insertIncidentReportSchema = createInsertSchema(incidentReports).pick({
  userId: true,
  category: true,
  subcategory: true,
  description: true,
  anonymous: true,
  reportMode: true,
  severity: true,
  occurrenceWindow: true,
  location: true,
  peopleInvolved: true,
  followUpRequested: true,
});

export const submitIncidentReportSchema = z.object({
  userId: z.string().min(1).nullable(),
  category: z.string().min(1).max(80),
  subcategory: z.string().min(1).max(160),
  description: z.string().trim().max(4000).nullable(),
  anonymous: z.boolean(),
  reportMode: incidentReportModeSchema,
  severity: incidentSeveritySchema.nullable(),
  occurrenceWindow: incidentOccurrenceWindowSchema.nullable(),
  location: z.string().trim().max(160).nullable(),
  peopleInvolved: z.string().trim().max(240).nullable(),
  followUpRequested: z.boolean(),
}).superRefine((data, ctx) => {
  const isFormal = data.reportMode === "formal";
  const isAnonymous = data.reportMode === "anonymous";
  if (isFormal && data.anonymous) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["anonymous"],
      message: "Denúncia formal não pode ser anônima",
    });
  }
  if (isFormal && data.userId === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userId"],
      message: "Denúncia formal precisa estar vinculada à sua conta",
    });
  }
  if (isFormal && data.occurrenceWindow === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["occurrenceWindow"],
      message: "Informe quando a situação aconteceu",
    });
  }
  if (isFormal && (data.description === null || data.description.length < 12)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["description"],
      message: "Descreva a situação com um pouco mais de detalhe",
    });
  }
  if (isAnonymous && data.severity === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["severity"],
      message: "Selecione o nível de severidade",
    });
  }
});

export const insertUserMissionSchema = createInsertSchema(userMissions).pick({
  userId: true,
  missionId: true,
  date: true,
  pointsEarned: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  settings: true,
});

export const insertSolarPointsSchema = createInsertSchema(solarPoints).pick({
  userId: true,
  action: true,
  points: true,
  date: true,
});

export const insertTeamChallengeContributionSchema = createInsertSchema(teamChallengeContributions).pick({
  userId: true,
  challengeId: true,
  amount: true,
  date: true,
});

export const insertPulseResponseSchema = createInsertSchema(pulseResponses).pick({
  userId: true,
  pulseKey: true,
  pulseVersion: true,
  windowStart: true,
  windowEnd: true,
  answers: true,
  scoreSummary: true,
});

export const insertCommunityMessageSchema = createInsertSchema(communityMessages).pick({
  userId: true,
  authorName: true,
  isAnonymous: true,
  content: true,
  audioUrl: true,
  mediaType: true,
  category: true,
});

export const submitCommunityMessageSchema = z.object({
  content: z.string().trim().min(10).max(280).nullable().optional(),
  audioUrl: z.string().max(2000).nullable().optional(),
  mediaType: z.enum(["text", "audio"]).default("text"),
  isAnonymous: z.boolean(),
  category: z.string().max(40).nullable().optional(),
}).refine(
  (d) => (d.mediaType === "text" && d.content && d.content.length >= 10) || (d.mediaType === "audio" && d.audioUrl),
  { message: "Forneça conteúdo de texto (min 10 chars) ou áudio" },
);

export const pulseAnswerValueSchema = z.enum(["never", "rarely", "often", "always"]);

export const pulseSubmissionAnswerSchema = z.object({
  questionId: z.string().min(1).max(80),
  value: pulseAnswerValueSchema,
});

export const submitPulseResponseSchema = z.object({
  userId: z.string().min(1),
  pulseKey: z.string().min(1).max(80),
  pulseVersion: z.number().int().positive(),
  windowStart: isoDateSchema,
  windowEnd: isoDateSchema,
  answers: z.array(pulseSubmissionAnswerSchema).min(1),
});

export const insertChatConversationSchema = createInsertSchema(chatConversations).pick({
  userId: true,
  title: true,
  orchestratorSessionId: true,
  orchestratorConversationId: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  conversationId: true,
  role: true,
  content: true,
});

// ── Type exports ──────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTenantPlan = z.infer<typeof insertTenantPlanSchema>;
export type TenantPlan = typeof tenantPlans.$inferSelect;
export type CreateTenantPlan = z.infer<typeof createTenantPlanSchema>;
export type UpdateTenantPlan = z.infer<typeof updateTenantPlanSchema>;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type CreateTenant = z.infer<typeof createTenantSchema>;
export type UpdateTenant = z.infer<typeof updateTenantSchema>;
export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type CreateBillingPeriod = z.infer<typeof createBillingPeriodSchema>;
export type UpdateBillingPeriodUsage = z.infer<typeof updateBillingPeriodUsageSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;
export type BillingPeriodStatus = z.infer<typeof billingPeriodStatusSchema>;
export type InsertTenantMembership = z.infer<typeof insertTenantMembershipSchema>;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type CreateTenantMembership = z.infer<typeof createTenantMembershipSchema>;
export type UpdateTenantMembership = z.infer<typeof updateTenantMembershipSchema>;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkIns.$inferSelect;
export type InsertMomentCheckIn = z.infer<typeof insertMomentCheckInSchema>;
export type MomentCheckIn = typeof momentCheckIns.$inferSelect;
export type InsertIncidentReport = z.infer<typeof insertIncidentReportSchema>;
export type IncidentReport = typeof incidentReports.$inferSelect;
export type SubmitIncidentReport = z.infer<typeof submitIncidentReportSchema>;
export type InsertUserMission = z.infer<typeof insertUserMissionSchema>;
export type UserMission = typeof userMissions.$inferSelect;
export type InsertSolarPoints = z.infer<typeof insertSolarPointsSchema>;
export type SolarPoints = typeof solarPoints.$inferSelect;
export type SolarStreak = typeof solarStreaks.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertTeamChallengeContribution = z.infer<typeof insertTeamChallengeContributionSchema>;
export type TeamChallengeContribution = typeof teamChallengeContributions.$inferSelect;
export type InsertPulseResponse = z.infer<typeof insertPulseResponseSchema>;
export type PulseResponse = typeof pulseResponses.$inferSelect;
export type PulseSubmissionAnswer = z.infer<typeof pulseSubmissionAnswerSchema>;
export type SubmitPulseResponse = z.infer<typeof submitPulseResponseSchema>;
export type InsertCommunityMessage = z.infer<typeof insertCommunityMessageSchema>;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type MessageLike = typeof messageLikes.$inferSelect;
export type SubmitCommunityMessage = z.infer<typeof submitCommunityMessageSchema>;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type IncidentReportMode = z.infer<typeof incidentReportModeSchema>;
export type IncidentOccurrenceWindow = z.infer<typeof incidentOccurrenceWindowSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type TenantAudience = z.infer<typeof tenantAudienceSchema>;
export type TenantStatus = z.infer<typeof tenantStatusSchema>;
export type TenantMembershipRole = z.infer<typeof tenantMembershipRoleSchema>;
export type TenantCapability = z.infer<typeof tenantCapabilitySchema>;

/** Canonical check-in history record returned by GET /api/checkins/user/:id/history */
export interface CheckInHistoryRecord {
  readonly date: string; // "YYYY-MM-DD"
  readonly domainScores: {
    readonly recarga: number;
    readonly "estado-do-dia": number;
    readonly "seguranca-relacional": number;
  };
  readonly flags: string[];
}

/** Dimension breakdown inside RhPulseAggregate (null when masked by k-anonymity). */
export interface RhPulseDimensionScores {
  readonly pressure_predictability: number | null;
  readonly support_care: number | null;
  readonly peer_relations: number | null;
  readonly role_clarity: number | null;
}

/**
 * Aggregate of formal pulse responses for the RH dashboard.
 * Follows k-anonymity: all scores are null when respondentCount < ANONYMITY_THRESHOLD.
 * Returned by GET /api/rh/pulses/aggregate.
 */
export interface RhPulseAggregate {
  readonly windowStart: string;            // ISO date of earliest response in window
  readonly windowEnd: string;              // ISO date of latest response in window
  readonly respondentCount: number;
  readonly totalCollaborators: number;
  readonly participationRate: number;      // 0–100, rounded
  readonly eligible: boolean;              // true if respondentCount >= ANONYMITY_THRESHOLD
  readonly overallScore: number | null;   // null when not eligible
  readonly dimensionScores: RhPulseDimensionScores | null; // null when not eligible
  readonly previousOverallScore: number | null; // prior 45-day cycle, null if no data
  readonly trendDelta: number | null;      // overallScore - previousOverallScore
}
