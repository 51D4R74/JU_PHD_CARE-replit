import { PULSE_RESPONSE_WINDOW_DAYS, PULSE_SURVEY_INTERVAL_DAYS } from "./constants";
import { devNow } from "./dev-clock";

export type PulseAnswerValue = "never" | "rarely" | "often" | "always";
export type PulseDimension =
  | "pressure_predictability"
  | "support_care"
  | "peer_relations"
  | "role_clarity";

export interface PulseSubmissionAnswer {
  readonly questionId: string;
  readonly value: PulseAnswerValue;
}

export interface PulseQuestion {
  readonly id: string;
  readonly dimension: PulseDimension;
  readonly prompt: string;
  readonly reverseScored: boolean;
}

export interface PulseDefinition {
  readonly key: string;
  readonly version: number;
  readonly title: string;
  readonly description: string;
  readonly cadenceDays: number;
  readonly responseWindowDays: number;
  readonly estimatedSeconds: number;
  readonly questions: readonly PulseQuestion[];
}

export interface PulseScoreSummary {
  readonly overallScore: number;
  readonly answeredCount: number;
  readonly dimensionScores: Record<PulseDimension, number>;
}

export interface CurrentPulseWindow {
  readonly windowStart: string;
  readonly windowEnd: string;
}

export interface LatestPulseSnapshot {
  readonly id: string;
  readonly pulseKey: string;
  readonly pulseVersion: number;
  readonly submittedAt: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly scoreSummary: PulseScoreSummary;
}

export interface CurrentPulseState {
  readonly definition: PulseDefinition;
  readonly isDue: boolean;
  readonly window: CurrentPulseWindow;
  readonly nextEligibleAt: string | null;
  readonly latestResponse: LatestPulseSnapshot | null;
}

const OPTION_SCORES: Record<PulseAnswerValue, number> = {
  never: 0,
  rarely: 1,
  often: 2,
  always: 3,
};

export const PULSE_RESPONSE_OPTIONS = [
  { value: "never", label: "Nunca" },
  { value: "rarely", label: "Raramente" },
  { value: "often", label: "Com frequência" },
  { value: "always", label: "Sempre" },
] as const satisfies ReadonlyArray<{ readonly value: PulseAnswerValue; readonly label: string }>;

export const PULSE_DIMENSION_LABELS: Record<PulseDimension, string> = {
  pressure_predictability: "Pressão e previsibilidade",
  support_care: "Suporte e cuidado",
  peer_relations: "Relação entre pares",
  role_clarity: "Clareza e organização",
};

export const RELATIONAL_MONTHLY_PULSE: PulseDefinition = {
  key: "relational-monthly",
  version: 1,
  title: "Pulse Relacional Mensal",
  description: "Leitura curta sobre pressão, suporte, convivência e clareza do trabalho.",
  cadenceDays: PULSE_SURVEY_INTERVAL_DAYS,
  responseWindowDays: PULSE_RESPONSE_WINDOW_DAYS,
  estimatedSeconds: 60,
  questions: [
    {
      id: "rel_pulse_pressure",
      dimension: "pressure_predictability",
      prompt: "Na última quinzena, a pressão por resultado pareceu razoável e explicada.",
      reverseScored: false,
    },
    {
      id: "rel_pulse_unfair_pressure",
      dimension: "pressure_predictability",
      prompt: "Na última quinzena, senti pressão difícil de prever ou desproporcional.",
      reverseScored: true,
    },
    {
      id: "rel_pulse_support",
      dimension: "support_care",
      prompt: "Quando o trabalho pesou, percebi apoio real da liderança ou do ambiente próximo.",
      reverseScored: false,
    },
    {
      id: "rel_pulse_disregard",
      dimension: "support_care",
      prompt: "Na última quinzena, senti que meu esforço foi ignorado, desvalorizado ou tratado sem cuidado.",
      reverseScored: true,
    },
    {
      id: "rel_pulse_peers",
      dimension: "peer_relations",
      prompt: "A convivência com colegas foi colaborativa e respeitosa.",
      reverseScored: false,
    },
    {
      id: "rel_pulse_peer_tension",
      dimension: "peer_relations",
      prompt: "Na última quinzena, houve tensão, exclusão ou hostilidade entre colegas.",
      reverseScored: true,
    },
    {
      id: "rel_pulse_role_clarity",
      dimension: "role_clarity",
      prompt: "Eu soube com clareza o que era esperado de mim.",
      reverseScored: false,
    },
    {
      id: "rel_pulse_ambiguity",
      dimension: "role_clarity",
      prompt: "Na última quinzena, trabalhei com falta de clareza sobre prioridades, papéis ou critérios.",
      reverseScored: true,
    },
  ],
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeAnswerScore(value: PulseAnswerValue, reverseScored: boolean): number {
  const base = (OPTION_SCORES[value] / 3) * 100;
  const normalized = reverseScored ? 100 - base : base;
  return Math.round(normalized);
}

export function getPulseDefinitionByKey(key: string): PulseDefinition | null {
  return key === RELATIONAL_MONTHLY_PULSE.key ? RELATIONAL_MONTHLY_PULSE : null;
}

export function toPulseAnswerRecord(
  answers: readonly PulseSubmissionAnswer[],
): Record<string, PulseAnswerValue> {
  return answers.reduce((record, answer) => {
    record[answer.questionId] = answer.value;
    return record;
  }, {} as Record<string, PulseAnswerValue>);
}

export function hasCompletePulseAnswerSet(
  definition: PulseDefinition,
  answers: readonly PulseSubmissionAnswer[],
): boolean {
  if (answers.length !== definition.questions.length) {
    return false;
  }

  const expectedIds = new Set(definition.questions.map((question) => question.id));
  const seenIds = new Set<string>();

  return answers.every((answer) => {
    if (!expectedIds.has(answer.questionId) || seenIds.has(answer.questionId)) {
      return false;
    }
    seenIds.add(answer.questionId);
    return true;
  });
}

export function scorePulseAnswers(
  definition: PulseDefinition,
  answers: Record<string, PulseAnswerValue>,
): PulseScoreSummary {
  const dimensionBuckets = definition.questions.reduce((buckets, question) => {
    const value = answers[question.id];
    if (value === undefined) {
      return buckets;
    }

    const score = normalizeAnswerScore(value, question.reverseScored);
    buckets[question.dimension].push(score);
    return buckets;
  }, {
    pressure_predictability: [],
    support_care: [],
    peer_relations: [],
    role_clarity: [],
  } as Record<PulseDimension, number[]>);

  const dimensionScores = Object.entries(dimensionBuckets).reduce((summary, [dimension, values]) => {
    const score = values.length === 0
      ? 0
      : Math.round(values.reduce((total, value) => total + value, 0) / values.length);
    summary[dimension as PulseDimension] = score;
    return summary;
  }, {
    pressure_predictability: 0,
    support_care: 0,
    peer_relations: 0,
    role_clarity: 0,
  } as Record<PulseDimension, number>);

  const allScores = Object.values(dimensionBuckets).flat();
  const overallScore = allScores.length === 0
    ? 0
    : Math.round(allScores.reduce((total, value) => total + value, 0) / allScores.length);

  return {
    overallScore,
    answeredCount: allScores.length,
    dimensionScores,
  };
}

export function parsePulseScoreSummary(raw: string): PulseScoreSummary | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PulseScoreSummary> & {
      readonly dimensionScores?: Partial<Record<PulseDimension, number>>;
    };

    if (typeof parsed.overallScore !== "number" || typeof parsed.answeredCount !== "number") {
      return null;
    }

    const dimensionScores = parsed.dimensionScores;
    if (!dimensionScores) {
      return null;
    }

    const pressure = dimensionScores.pressure_predictability;
    const support = dimensionScores.support_care;
    const peers = dimensionScores.peer_relations;
    const clarity = dimensionScores.role_clarity;

    if ([pressure, support, peers, clarity].some((value) => typeof value !== "number")) {
      return null;
    }

    return {
      overallScore: Math.round(parsed.overallScore),
      answeredCount: Math.round(parsed.answeredCount),
      dimensionScores: {
        pressure_predictability: Math.round(pressure ?? 0),
        support_care: Math.round(support ?? 0),
        peer_relations: Math.round(peers ?? 0),
        role_clarity: Math.round(clarity ?? 0),
      },
    };
  } catch {
    return null;
  }
}

export function buildCurrentPulseState(
  latestResponse: LatestPulseSnapshot | null,
  referenceDate = devNow(),
): CurrentPulseState {
  if (latestResponse === null) {
    return {
      definition: RELATIONAL_MONTHLY_PULSE,
      isDue: true,
      window: {
        windowStart: toIsoDate(referenceDate),
        windowEnd: toIsoDate(addDays(referenceDate, RELATIONAL_MONTHLY_PULSE.responseWindowDays - 1)),
      },
      nextEligibleAt: null,
      latestResponse: null,
    };
  }

  const nextEligibleDate = addDays(new Date(latestResponse.submittedAt), RELATIONAL_MONTHLY_PULSE.cadenceDays);
  const nextEligibleAt = toIsoDate(nextEligibleDate);

  if (nextEligibleDate.getTime() > referenceDate.getTime()) {
    return {
      definition: RELATIONAL_MONTHLY_PULSE,
      isDue: false,
      window: {
        windowStart: nextEligibleAt,
        windowEnd: toIsoDate(addDays(nextEligibleDate, RELATIONAL_MONTHLY_PULSE.responseWindowDays - 1)),
      },
      nextEligibleAt,
      latestResponse,
    };
  }

  return {
    definition: RELATIONAL_MONTHLY_PULSE,
    isDue: true,
    window: {
      windowStart: toIsoDate(referenceDate),
      windowEnd: toIsoDate(addDays(referenceDate, RELATIONAL_MONTHLY_PULSE.responseWindowDays - 1)),
    },
    nextEligibleAt: null,
    latestResponse,
  };
}