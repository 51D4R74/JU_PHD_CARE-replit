import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const incidentReportModeSchema = z.enum(["anonymous", "formal"]);
const incidentOccurrenceWindowSchema = z.enum(["today", "this_week", "this_month", "older"]);
const incidentSeveritySchema = z.enum(["low", "moderate", "high", "emergency"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("collaborator"),
  department: text("department"),
});

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

// ── Insert schemas ────────────────────────────────

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  department: true,
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

// ── Type exports ──────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
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
export type IncidentReportMode = z.infer<typeof incidentReportModeSchema>;
export type IncidentOccurrenceWindow = z.infer<typeof incidentOccurrenceWindowSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;

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
