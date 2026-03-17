import type { IconType } from "react-icons";
import { devNow } from "@shared/dev-clock";
import {
  TbSparkles,
  TbMoonStars,
  TbCloudStorm,
  TbSkull,
  TbFlame,
  TbMoodEmpty,
  TbMoodSad,
  TbMoodNervous,
  TbSun,
  TbCloudRain,
  TbCloud,
  TbCloudBolt,
  TbBolt,
  TbBattery4,
  TbBattery2,
  TbBattery1,
  TbBatteryOff,
  TbCheck,
  TbTemperature,
  TbAlertTriangle,
  TbDoor,
  TbMoodConfuzed,
  TbMoodSmile,
  TbTrophy,
  TbZzz,
  TbMoodHappy,
  TbFriends,
  TbMoodAngry,
  TbSunrise,
  TbBriefcase,
  TbUserExclamation,
  TbUsers,
  TbUserOff,
  TbUser,
  TbCoin,
  TbHeartbeat,
  TbHeartHandshake,
  TbDots,
  TbActivity,
  TbRocket,
  TbLeaf,
} from "react-icons/tb";

// ── Types ─────────────────────────────────────────

export type MomentId = "morning" | "midday" | "endday";

export interface StepOption {
  id: string;
  label: string;
  icon: IconType;
  score: number;
  color: string; // Tailwind color class (text-*)
  bgColor: string; // Tailwind gradient (from-*/to-*)
  flag?: string;
  sensitive?: boolean;
  triggerChat?: boolean;
  exclusive?: boolean;
}

export interface ProjectionOption {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  flag?: string;
  triggerChat?: boolean;
}

export interface ProjectionCard {
  text: string;
  sublabel: string;
  options: ProjectionOption[];
}

export interface FollowUp {
  question: string;
  deltaOptions?: ReadonlyArray<{ readonly id: string; readonly label: string; readonly delta: number }>;
}

export type StepType = "single" | "projection" | "multi2" | "multi3" | "tags";

export interface CheckInStep {
  id: string;
  type: StepType;
  question: string;
  sublabel?: string;
  options: StepOption[];
  followUp?: FollowUp;
  projectionCard?: ProjectionCard;
}

export interface MomentConfig {
  id: MomentId;
  label: string;
  icon: IconType;
  time: string;
  subtitle: string;
  description: string;
}

// ── Sky & Score types ─────────────────────────────

export type SkyState = "clear" | "partly-cloudy" | "protective-cloud" | "respiro";
export type ScoreDomainId = "recarga" | "estado-do-dia" | "seguranca-relacional";

export interface ScoreDomain {
  id: ScoreDomainId;
  label: string;
  description: string;
  /** Step ids that contribute to this domain */
  questionIds: string[];
  /** Sum of max possible scores from contributing questions */
  maxRaw: number;
}

// ── Moments ───────────────────────────────────────

export const MOMENTS: Record<MomentId, MomentConfig> = {
  morning: {
    id: "morning",
    label: "Manhã",
    icon: TbSunrise,
    time: "Início do dia",
    subtitle: "Antes de começar o trabalho",
    description:
      "Leva ~40s. Saber como você começa o dia ajuda a cuidar melhor ao longo dele.",
  },
  midday: {
    id: "midday",
    label: "Intervalo",
    icon: TbSun,
    time: "Meio do dia",
    subtitle: "Durante ou após o almoço",
    description:
      "O momento mais revelador. Captura o que acontece durante o expediente — inclusive o clima com as pessoas.",
  },
  endday: {
    id: "endday",
    label: "Fim do dia",
    icon: TbCloudRain,
    time: "Saída do trabalho",
    subtitle: "Depois que o expediente termina",
    description:
      "Como você fecha o dia diz muito. Olhar pra trás costuma trazer respostas mais honestas.",
  },
};

export const MOMENT_ORDER: MomentId[] = ["morning", "midday", "endday"];

// ── Morning steps ─────────────────────────────────

export const MORNING_STEPS: CheckInStep[] = [
  {
    id: "sleep",
    type: "single",
    question: "Como você dormiu?",
    options: [
      { id: "restorative", label: "Dormi bem", icon: TbSparkles, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "acceptable", label: "Sono razoável", icon: TbMoonStars, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "agitated", label: "Noite agitada", icon: TbCloudStorm, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "terrible", label: "Quase não dormi", icon: TbSkull, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
    ],
  },
  {
    id: "morning_anticipation",
    type: "single",
    question: "Como você se sente sobre o dia que começa?",
    sublabel: "Só sobre hoje — sem pensar no resto.",
    options: [
      { id: "excited", label: "Com vontade", icon: TbFlame, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "ok", label: "Tanto faz", icon: TbMoodEmpty, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "reluctant", label: "Sem muita vontade", icon: TbMoodSad, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "dreading", label: "Com receio", icon: TbMoodNervous, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", sensitive: true },
    ],
  },
  {
    id: "morning_environment_projection",
    type: "projection",
    question: "Como as pessoas costumam chegar no seu ambiente de trabalho?",
    sublabel: "Pense no que vem do ambiente, não de você.",
    options: [
      { id: "env_light", label: "Com leveza e confiança", icon: TbSun, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "env_ok", label: "No automático", icon: TbCloudRain, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "env_tense", label: "Com tensão no ar", icon: TbCloud, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5", flag: "climate_risk" },
      { id: "env_fear", label: "Com medo ou ansiedade", icon: TbCloudBolt, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "harassment_signal" },
    ],
  },
];

// ── Midday steps ──────────────────────────────────

export const MIDDAY_STEPS: CheckInStep[] = [
  {
    id: "energy_now",
    type: "single",
    question: "Como tá a energia?",
    options: [
      { id: "full", label: "100%", icon: TbBattery4, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "ok", label: "Dá pro gasto", icon: TbBattery2, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "low", label: "Tá difícil", icon: TbBattery1, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "empty", label: "No vermelho", icon: TbBatteryOff, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
    ],
    followUp: {
      question: "Atrapalhou o trabalho?",
    },
  },
  {
    id: "relational_climate",
    type: "multi2",
    question: "Como está o clima ao seu redor agora?",
    sublabel: "É sobre o que vem de fora, não de dentro.",
    options: [
      { id: "all_good", label: "Tudo tranquilo", icon: TbCheck, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5", exclusive: true },
      { id: "heavy_air", label: "Clima pesado", icon: TbTemperature, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5", flag: "climate_risk" },
      { id: "pressured", label: "Sinto pressão", icon: TbAlertTriangle, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "harassment_signal", triggerChat: true },
      { id: "isolated", label: "Me sinto isolado", icon: TbDoor, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "harassment_signal", triggerChat: true },
      { id: "uncomfortable", label: "Desconfortável com alguém", icon: TbMoodConfuzed, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "harassment_signal", triggerChat: true },
    ],
    projectionCard: {
      text: "Alguém no seu ambiente pode estar passando por algo difícil?",
      sublabel: "Pode responder pensando em outra pessoa.",
      options: [
        { id: "proj_no", label: "Não percebi nada", color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
        { id: "proj_maybe", label: "Talvez sim", color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5", flag: "peer_concern" },
        { id: "proj_yes", label: "Sim, percebi algo", color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "peer_harassment_proxy", triggerChat: true },
      ],
    },
  },
];

// ── End-of-day steps ──────────────────────────────

export const ENDDAY_STEPS: CheckInStep[] = [
  {
    id: "emotion_retrospective",
    type: "multi3",
    question: "Como você sai de hoje?",
    sublabel: "Pode escolher até 3 — emoções se misturam mesmo.",
    options: [
      { id: "relieved", label: "Com alívio", icon: TbMoodSmile, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "satisfied", label: "Realizado", icon: TbTrophy, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "calm", label: "Em paz", icon: TbMoodHappy, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "tired", label: "Cansado", icon: TbZzz, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "frustrated", label: "Frustrado", icon: TbMoodAngry, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "sad", label: "Triste", icon: TbMoodSad, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "anxious", label: "Ansioso", icon: TbMoodNervous, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "angry", label: "Irritado", icon: TbMoodAngry, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
    ],
  },
  {
    id: "context_tags",
    type: "tags",
    question: "Teve algo que pesou?",
    sublabel: "Opcional — ajuda a entender padrões, sem te identificar.",
    options: [
      { id: "work_load", label: "Volume de trabalho", icon: TbBriefcase, score: 0, color: "text-foreground", bgColor: "", flag: "workload" },
      { id: "leadership", label: "Liderança / Gestão", icon: TbUserExclamation, score: 0, color: "text-foreground", bgColor: "", flag: "leadership_risk" },
      { id: "peer", label: "Colegas", icon: TbUsers, score: 0, color: "text-foreground", bgColor: "", flag: "peer_risk" },
      { id: "client", label: "Cliente / Externo", icon: TbFriends, score: 0, color: "text-foreground", bgColor: "", flag: "external" },
      { id: "personal", label: "Algo pessoal", icon: TbUserOff, score: 0, color: "text-foreground", bgColor: "", flag: "personal" },
      { id: "finances", label: "Finanças", icon: TbCoin, score: 0, color: "text-foreground", bgColor: "", flag: "financial_stress" },
      { id: "health", label: "Saúde", icon: TbHeartbeat, score: 0, color: "text-foreground", bgColor: "", flag: "health" },
      { id: "nothing", label: "Nada demais", icon: TbDots, score: 0, color: "text-foreground", bgColor: "", exclusive: true },
    ],
  },
  {
    id: "tomorrow_anticipation",
    type: "single",
    question: "E amanhã, como você se sente?",
    options: [
      { id: "looking_forward", label: "Com vontade", icon: TbSunrise, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "neutral", label: "Tanto faz", icon: TbMoodEmpty, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "not_really", label: "Preferia não ir", icon: TbMoodSad, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5", sensitive: true },
      { id: "dreading", label: "Pensar nisso me pesa", icon: TbMoodNervous, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", sensitive: true, triggerChat: true },
    ],
  },
];

// ── Step map per moment ───────────────────────────

export const STEPS_BY_MOMENT: Record<MomentId, CheckInStep[]> = {
  morning: MORNING_STEPS,
  midday: MIDDAY_STEPS,
  endday: ENDDAY_STEPS,
};

// ── Chat trigger messages ─────────────────────────

export interface ChatTriggerConfig {
  message: string;
  cta: string;
  anonymousNote: string;
}

export const CHAT_TRIGGERS: Record<string, ChatTriggerConfig> = {
  pressured: {
    message:
      `Percebi que algo no ambiente pode estar pesando.\n\nQuer conversar? Posso só ouvir, sem cobranças.`,
    cta: "Conversar com JuPHD Care",
    anonymousNote: "Nada chega ao RH sem a sua autorização.",
  },
  proj_yes: {
    message:
      `Você percebeu que alguém ao redor pode estar passando por algo difícil.\n\nSe quiser, posso ajudar a entender a situação — seja pra apoiar essa pessoa, ou se você também estiver nela.`,
    cta: "Continuar em segurança",
    anonymousNote: "Você pode falar por outra pessoa. Tudo aqui é confidencial.",
  },
  dreading_tomorrow: {
    message:
      `Parece que pensar em amanhã não está sendo leve.\n\nIsso é mais comum do que parece, e você não precisa passar por isso só.`,
    cta: "Conversar agora",
    anonymousNote: "Disponível 24h. Nada vai ao RH.",
  },
};

// ── Helpers ───────────────────────────────────────

/** Detect which chat trigger (if any) should fire based on step answers. */
export function detectChatTrigger(
  stepId: string,
  answer: string | string[],
  steps: CheckInStep[],
  projAnswer?: ProjectionOption | null,
): string | null {
  if (projAnswer?.flag === "peer_harassment_proxy") return "proj_yes";

  const allOpts = steps.flatMap((s) => s.options);
  const ids = Array.isArray(answer) ? answer : [answer];

  for (const optId of ids) {
    const opt = allOpts.find((o) => o.id === optId);
    if (opt?.triggerChat) {
      if (opt.flag === "harassment_signal") return "pressured";
    }
    if (optId === "dreading" && stepId === "tomorrow_anticipation")
      return "dreading_tomorrow";
  }

  return null;
}

/** Collect all flags from a set of answers. */
export function collectFlags(
  answers: Record<string, string | string[]>,
  steps: CheckInStep[],
): string[] {
  const flags: string[] = [];
  const allOpts = steps.flatMap((s) => s.options);

  for (const [, val] of Object.entries(answers)) {
    const ids = Array.isArray(val) ? val : [val];
    for (const id of ids) {
      const opt = allOpts.find((o) => o.id === id);
      if (opt?.flag) flags.push(opt.flag);
    }
  }

  return Array.from(new Set(flags));
}

/** Compute total score from answers (sum of all answered option scores). */
export function computeScores(
  answers: Record<string, string | string[]>,
  steps: CheckInStep[],
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const step of steps) {
    const val = answers[step.id];
    if (!val) continue;
    const ids = Array.isArray(val) ? val : [val];
    const stepScore = ids.reduce((sum, id) => {
      const opt = step.options.find((o) => o.id === id);
      return sum + (opt?.score ?? 0);
    }, 0);
    scores[step.id] = stepScore;
  }

  return scores;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Daily check-in model (replaces 3-moment EMA in S2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Single daily check-in: 6 questions across 3 score domains. */
export const DAILY_STEPS: CheckInStep[] = [
  // Q1: Sleep quality → Recarga
  {
    id: "sleep",
    type: "single",
    question: "Como você dormiu?",
    options: [
      { id: "restorative", label: "Acordei renovado(a)", icon: TbSunrise, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "acceptable", label: "Noite tranquila", icon: TbMoonStars, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "agitated", label: "Noite agitada", icon: TbCloudBolt, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "terrible", label: "Acordei exausto(a)", icon: TbBatteryOff, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
    ],
  },
  // Q2: Energy → Recarga
  {
    id: "energy",
    type: "single",
    question: "Como tá a energia?",
    options: [
      { id: "full", label: "No pique", icon: TbBolt, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "ok", label: "No ritmo", icon: TbActivity, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "low", label: "Com pouco gás", icon: TbBattery1, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "empty", label: "Esgotado(a)", icon: TbBatteryOff, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
    ],
    followUp: {
      question: "Atrapalhou o trabalho?",
      deltaOptions: [
        { id: "sim", label: "Bastante", delta: 0.5 },
        { id: "mais_ou_menos", label: "Um pouco", delta: 0.2 },
        { id: "nao", label: "De boa", delta: 0 },
      ],
    },
  },
  // Q3: Emotional state → Estado do dia (multi3, 6 options, exactly 2 selections)
  {
    id: "emotion",
    type: "multi3",
    question: "Como você está se sentindo?",
    sublabel: "Escolha 2 que mais se aproximam do que você está sentindo agora.",
    options: [
      { id: "good", label: "Bem", icon: TbMoodHappy, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "motivated", label: "Motivado(a)", icon: TbRocket, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "calm", label: "Tranquilo(a)", icon: TbLeaf, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "anxious", label: "Ansioso(a)", icon: TbHeartbeat, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5", flag: "anxiety_signal" },
      { id: "irritated", label: "Irritado(a)", icon: TbFlame, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5", flag: "stress_signal" },
      { id: "sad", label: "Triste(a)", icon: TbMoodSad, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "mood_risk" },
    ],
  },
  // Q4: Emotional exit → Estado do dia
  {
    id: "day_impact",
    type: "single",
    question: "Como o dia te deixou?",
    options: [
      { id: "light", label: "Em paz", icon: TbSun, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "tired_ok", label: "Cansado, mas inteiro", icon: TbZzz, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "frustrated", label: "Frustrado", icon: TbMoodAngry, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
      { id: "overwhelmed", label: "Esgotado", icon: TbBatteryOff, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
    ],
  },
  // Q5: ICE momentânea → Segurança relacional (single)
  {
    id: "safety",
    type: "single",
    question: "Como foi o clima ao seu redor?",
    options: [
      { id: "supported", label: "Me senti apoiado(a)", icon: TbHeartHandshake, score: 4, color: "text-score-good", bgColor: "from-score-good/20 to-score-good/5" },
      { id: "normal", label: "Dia normal", icon: TbMoodEmpty, score: 3, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
      { id: "tense", label: "Clima tenso", icon: TbAlertTriangle, score: 2, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5", flag: "climate_risk" },
      { id: "pressured", label: "Me senti pressionado(a)", icon: TbCloudBolt, score: 1, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5", flag: "harassment_signal" },
    ],
  },
  // Q6: Context tags (optional, no score) — PRD v2.0 S5
  {
    id: "context_tags",
    type: "tags",
    question: "Teve algo que pesou?",
    sublabel: "Opcional — ajuda a entender padrões, sem te identificar.",
    options: [
      { id: "work_load", label: "Volume de demandas", icon: TbBriefcase, score: 0, color: "text-foreground", bgColor: "", flag: "workload" },
      { id: "leadership", label: "Liderança / Gestão", icon: TbUserExclamation, score: 0, color: "text-foreground", bgColor: "", flag: "hlb_proxy" },
      { id: "peer", label: "Colegas / Clima", icon: TbUsers, score: 0, color: "text-foreground", bgColor: "", flag: "peer_risk" },
      { id: "client", label: "Cliente / Externo", icon: TbFriends, score: 0, color: "text-foreground", bgColor: "", flag: "external" },
      { id: "role_ambiguity", label: "Falta de clareza", icon: TbMoodConfuzed, score: 0, color: "text-foreground", bgColor: "", flag: "role_ambiguity" },
      { id: "personal", label: "Algo pessoal", icon: TbUser, score: 0, color: "text-foreground", bgColor: "", flag: "personal" },
      { id: "finances", label: "Finanças", icon: TbCoin, score: 0, color: "text-foreground", bgColor: "", flag: "financial_stress" },
      { id: "health", label: "Saúde", icon: TbHeartbeat, score: 0, color: "text-foreground", bgColor: "", flag: "health" },
      { id: "nothing", label: "Nada demais", icon: TbCheck, score: 0, color: "text-foreground", bgColor: "", exclusive: true },
    ],
  },
];

// ── Score domains ─────────────────────────────────

export const SCORE_DOMAINS: ScoreDomain[] = [
  {
    id: "recarga",
    label: "Recarga",
    description: "Seu sono e sua energia — a base de tudo",
    questionIds: ["sleep", "energy"],
    maxRaw: 8,
  },
  {
    id: "estado-do-dia",
    label: "Estado do dia",
    description: "Como você se sentiu e o que o dia deixou em você",
    questionIds: ["emotion", "day_impact"],
    maxRaw: 8,
  },
  {
    id: "seguranca-relacional",
    label: "Segurança relacional",
    description: "O clima entre você e as pessoas ao redor",
    questionIds: ["safety"],
    maxRaw: 4,
  },
];

// ── Daily check-in helpers ────────────────────────

/** Resolve the raw score contribution of a single question. */
function resolveQuestionScore(
  step: CheckInStep,
  val: string | string[],
): number {
  const ids = Array.isArray(val) ? val : [val];

  // multi2 (legacy safety): worst signal wins
  if (step.type === "multi2") {
    const scores = ids
      .map((id) => step.options.find((o) => o.id === id)?.score ?? 0)
      .filter((s) => s > 0);
    return scores.length > 0 ? Math.min(...scores) : 0;
  }

  // multi3 (emotion): mean of selected scores
  if (step.type === "multi3") {
    const scores = ids
      .map((id) => step.options.find((o) => o.id === id)?.score ?? 0);
    return scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }

  return step.options.find((o) => o.id === ids[0])?.score ?? 0;
}

/** Compute domain scores (0–100) from daily check-in answers. */
export function computeDomainScores(
  answers: Record<string, string | string[]>,
): Record<ScoreDomainId, number> {
  const result = {} as Record<ScoreDomainId, number>;

  for (const domain of SCORE_DOMAINS) {
    let raw = 0;
    for (const qId of domain.questionIds) {
      const step = DAILY_STEPS.find((s) => s.id === qId);
      const val = answers[qId];
      if (step && val) raw += resolveQuestionScore(step, val);
    }
    // BACKLOG: calibrate weights with clinical input [post-pilot]
    result[domain.id] = Math.round((raw / domain.maxRaw) * 100);
  }

  return result;
}

/** Derive sky state and solar halo level from domain scores + flags. */
export function deriveSkyState(
  domainScores: Record<ScoreDomainId, number>,
  flags: string[],
): { skyState: SkyState; solarHaloLevel: number } {
  const hasSafetyFlag = flags.some((f) =>
    ["harassment_signal", "peer_harassment_proxy"].includes(f),
  );

  // Safety flags trump everything — enter protective mode
  if (hasSafetyFlag || domainScores["seguranca-relacional"] < 25) {
    return { skyState: "respiro", solarHaloLevel: 0 };
  }

  const overall =
    (domainScores.recarga +
      domainScores["estado-do-dia"] +
      domainScores["seguranca-relacional"]) /
    3;

  if (overall >= 75) return { skyState: "clear", solarHaloLevel: overall / 100 };
  if (overall >= 50) return { skyState: "partly-cloudy", solarHaloLevel: overall / 100 };
  if (overall >= 25) return { skyState: "protective-cloud", solarHaloLevel: overall / 100 };
  return { skyState: "respiro", solarHaloLevel: 0 };
}

// ── M3 tag system ─────────────────────────────────

/**
 * Display labels for context tag flags (PT-BR).
 * Keys must match the `flag` property of context_tags options in DAILY_STEPS.
 */
export const CONTEXT_TAG_LABELS: Record<string, string> = {
  workload: "Volume de demandas",
  hlb_proxy: "Liderança / Gestão",
  peer_risk: "Colegas / Clima",
  external: "Cliente / Externo",
  role_ambiguity: "Falta de clareza",
  personal: "Situação pessoal",
  financial_stress: "Finanças",
  health: "Saúde",
};

/** Flags eligible for tag cloud and discovery engine (context tags only, no system-derived flags). */
export const CONTEXT_TAG_FLAGS: string[] = Object.keys(CONTEXT_TAG_LABELS);

/**
 * Reorder DAILY_STEPS so the first question is contextually relevant
 * to the time of day. Remaining questions keep their relative order.
 *
 * Morning  (before 12h): sleep first (default order)
 * Afternoon (12–17h):    energy first
 * Evening  (after 17h):  day_impact first
 */
export function getTimeAwareSteps(hour?: number): CheckInStep[] {
  const h = hour ?? devNow().getHours();

  if (h < 12) return DAILY_STEPS; // default order starts with sleep

  const leadId = h < 18 ? "energy" : "day_impact";
  const leadIdx = DAILY_STEPS.findIndex((s) => s.id === leadId);
  if (leadIdx <= 0) return DAILY_STEPS; // already first or not found

  return [
    DAILY_STEPS[leadIdx],
    ...DAILY_STEPS.filter((_, i) => i !== leadIdx),
  ];
}
