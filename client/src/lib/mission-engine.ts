/**
 * Mission engine — adaptive mission selection based on user state.
 *
 * Selects 3–4 missions from a pool of 50, weighted by:
 *   1. User state (stable / tense / respiro)
 *   2. Score domain deficits (recarga low → breathing/pause missions)
 *   3. Time of day (morning vs afternoon mix)
 *   4. Recency bias (avoid repeating yesterday's missions)
 */

import type { SkyState, ScoreDomainId } from "@/lib/checkin-data";
import { devNow } from "@shared/dev-clock";

// ── Types ─────────────────────────────────────────

export type MissionCategory =
  | "breathing"
  | "hydration"
  | "pause"
  | "gratitude"
  | "focus"
  | "connection"
  | "boundary"
  | "closure"
  | "movement"
  | "sensory"
  | "gym"
  | "social";

export const CATEGORY_LABELS: Record<MissionCategory, string> = {
  breathing: "Respiração",
  hydration: "Hidratação",
  pause: "Pausa",
  gratitude: "Gratidão",
  focus: "Foco",
  connection: "Conexão",
  boundary: "Limite",
  closure: "Encerramento",
  movement: "Movimento",
  sensory: "Sensorial",
  gym: "Atividade Física",
  social: "Social",
};

export const CATEGORY_COLORS: Record<MissionCategory, string> = {
  breathing: "bg-sky-100 text-sky-700",
  hydration: "bg-cyan-100 text-cyan-700",
  pause: "bg-amber-100 text-amber-700",
  gratitude: "bg-rose-100 text-rose-700",
  focus: "bg-indigo-100 text-indigo-700",
  connection: "bg-pink-100 text-pink-700",
  boundary: "bg-orange-100 text-orange-700",
  closure: "bg-violet-100 text-violet-700",
  movement: "bg-lime-100 text-lime-700",
  sensory: "bg-fuchsia-100 text-fuchsia-700",
  gym: "bg-emerald-100 text-emerald-700",
  social: "bg-teal-100 text-teal-700",
};

export type MissionDifficulty = "simple" | "medium" | "support";

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  difficulty: MissionDifficulty;
  points: number;
  preferredStates: SkyState[];
  targetDomain: ScoreDomainId | null;
  timeWindow: "morning" | "afternoon" | null;
}

export interface SelectedMission {
  id: string;
  title: string;
  description: string;
  points: number;
  category: MissionCategory;
}

// ── Mission pool (50 missions) ───────────────────

const MISSION_POOL: MissionTemplate[] = [
  // ── Breathing (4) ──
  {
    id: "breathing-box",
    title: "Respiração quadrada",
    description: "Inspire 4s, segure 4s, expire 4s, segure 4s. Repita 4 vezes.",
    category: "breathing",
    difficulty: "simple",
    points: 5,
    preferredStates: ["partly-cloudy", "protective-cloud", "respiro"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "breathing-calm",
    title: "Respiração calmante",
    description: "Inspire pelo nariz contando até 3, expire pela boca contando até 6.",
    category: "breathing",
    difficulty: "simple",
    points: 5,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "breathing-morning",
    title: "3 respirações ao despertar",
    description: "Antes de olhar o celular: 3 inspirações profundas pelo nariz.",
    category: "breathing",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "morning",
  },
  {
    id: "breathing-478",
    title: "Técnica 4-7-8",
    description: "Inspire 4s, segure 7s, expire 8s. Reduz ansiedade em minutos.",
    category: "breathing",
    difficulty: "medium",
    points: 8,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "recarga",
    timeWindow: null,
  },

  // ── Hydration (3) ──
  {
    id: "hydration-1",
    title: "Beba água agora",
    description: "Um copo de água faz mais do que parece. Seu corpo agradece.",
    category: "hydration",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "hydration-2",
    title: "Mais um gole de água",
    description: "Já faz um tempo desde o último copo. Que tal agora?",
    category: "hydration",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "afternoon",
  },
  {
    id: "hydration-cha",
    title: "Prepare um chá de ervas",
    description: "Camomila, erva-cidreira ou hortelã. O ritual já acalma.",
    category: "hydration",
    difficulty: "simple",
    points: 5,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "recarga",
    timeWindow: "afternoon",
  },

  // ── Pause (4) ──
  {
    id: "pause-2min",
    title: "Pausa de 2 minutos",
    description: "Levante, olhe pela janela, respire. Nem precisa pensar em nada.",
    category: "pause",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "pause-screen",
    title: "5 minutos sem tela",
    description: "Feche o notebook, guarde o celular. Seus olhos vão agradecer.",
    category: "pause",
    difficulty: "medium",
    points: 8,
    preferredStates: ["partly-cloudy", "protective-cloud"],
    targetDomain: "estado-do-dia",
    timeWindow: "afternoon",
  },
  {
    id: "pause-coffee",
    title: "Café ou chá consciente",
    description: "Prepare uma bebida quente. Beba sem pressa, sem multitarefa.",
    category: "pause",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: null,
    timeWindow: "morning",
  },
  {
    id: "pause-micro",
    title: "Micropausa de 30 segundos",
    description: "Feche os olhos. Solte os ombros. Respire uma vez. Pronto.",
    category: "pause",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: null,
  },

  // ── Gratitude (4) ──
  {
    id: "gratitude-note",
    title: "Reconheça algo bom",
    description: "Pode ser pequena. Uma frase já muda a percepção do dia.",
    category: "gratitude",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },
  {
    id: "gratitude-person",
    title: "Reconheça alguém hoje",
    description: "Uma mensagem rápida dizendo que notou algo que a pessoa fez.",
    category: "gratitude",
    difficulty: "support",
    points: 6,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "gratitude-body",
    title: "Agradeça ao seu corpo",
    description: "Ele te carregou até aqui. Note uma parte que funciona bem hoje.",
    category: "gratitude",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "morning",
  },
  {
    id: "gratitude-3things",
    title: "3 coisas boas do dia",
    description: "Antes de sair, liste mentalmente 3 coisas boas que aconteceram.",
    category: "gratitude",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: "afternoon",
  },

  // ── Connection (3) ──
  {
    id: "connection-check",
    title: "Conecte-se com alguém",
    description: "Escolha um colega e pergunte como foi o dia. De verdade.",
    category: "connection",
    difficulty: "support",
    points: 6,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "connection-smile",
    title: "Compartilhe um sorriso",
    description: "Genuíno, sem motivo. Muda o clima. Pode ser virtual também.",
    category: "connection",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "connection-listen",
    title: "Escuta ativa por 3 minutos",
    description: "Na próxima conversa, só escute. Sem pensar na resposta.",
    category: "connection",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },

  // ── Movement (4) ──
  {
    id: "movement-stretch",
    title: "Momento de alongamento",
    description: "Pescoço, ombros, punhos. Seu corpo tá esperando essa.",
    category: "movement",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "movement-walk",
    title: "5 minutos em movimento",
    description: "Nem precisa ser longe. Pelo corredor, pelo andar. Já vale.",
    category: "movement",
    difficulty: "medium",
    points: 8,
    preferredStates: ["partly-cloudy", "protective-cloud"],
    targetDomain: "recarga",
    timeWindow: "afternoon",
  },
  {
    id: "movement-stairs",
    title: "Suba um lance de escadas",
    description: "Troque o elevador pela escada. Um lance já ativa a circulação.",
    category: "movement",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "movement-posture",
    title: "Ajuste sua postura agora",
    description: "Ombros pra trás, coluna reta, pés no chão. Sinta a diferença.",
    category: "movement",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: null,
  },

  // ── Sensory (4) ──
  {
    id: "sensory-music",
    title: "Desacelere com uma música",
    description: "Coloque fone, feche os olhos se puder. Uma música só.",
    category: "sensory",
    difficulty: "simple",
    points: 5,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },
  {
    id: "sensory-sunlight",
    title: "Aproveite a luz natural",
    description: "2 min perto de uma janela ajustam seu ritmo mais do que parece.",
    category: "sensory",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "morning",
  },
  {
    id: "sensory-grounding",
    title: "Aterramento 5-4-3-2-1",
    description: "5 coisas que vê, 4 que toca, 3 que ouve, 2 que cheira, 1 que sente.",
    category: "sensory",
    difficulty: "simple",
    points: 5,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },
  {
    id: "sensory-aroma",
    title: "Perceba um aroma agradável",
    description: "Café, flor, sabonete. Foque 30 segundos só no cheiro.",
    category: "sensory",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },

  // ── Focus (4) ──
  {
    id: "focus-5min",
    title: "5 minutos de foco",
    description: "Uma tarefa, sem interrupções. Só 5 minutos — e veja o que acontece.",
    category: "focus",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },
  {
    id: "focus-priority",
    title: "Defina a prioridade do dia",
    description: "Uma coisa. A mais importante. Escreva e comece por ela.",
    category: "focus",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear"],
    targetDomain: "estado-do-dia",
    timeWindow: "morning",
  },
  {
    id: "focus-notification-off",
    title: "Desative notificações por 15 min",
    description: "Modo silencioso. Só você e a tarefa. O mundo espera.",
    category: "focus",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },
  {
    id: "focus-single-tab",
    title: "Feche todas as abas extras",
    description: "Deixe só a que precisa. Menos contexto visual, mais clareza.",
    category: "focus",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: null,
  },

  // ── Boundary (3) ──
  {
    id: "boundary-one",
    title: "Pratique um limite gentil",
    description: "Dizer 'agora não' é autocuidado. Um limite claro muda o dia.",
    category: "boundary",
    difficulty: "medium",
    points: 8,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "boundary-no-after-hours",
    title: "Não responda fora do horário",
    description: "O e-mail pode esperar até amanhã. Seu descanso não.",
    category: "boundary",
    difficulty: "medium",
    points: 8,
    preferredStates: [],
    targetDomain: "seguranca-relacional",
    timeWindow: "afternoon",
  },
  {
    id: "boundary-delegate",
    title: "Peça ajuda em algo",
    description: "Escolha uma tarefa e peça suporte. Dividir não é fraqueza.",
    category: "boundary",
    difficulty: "support",
    points: 6,
    preferredStates: ["protective-cloud", "respiro"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },

  // ── Closure (4) ──
  {
    id: "closure-day",
    title: "Feche o dia em 20 segundos",
    description: "O que fiz, o que ficou, como me sinto saindo. Três reflexões.",
    category: "closure",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: "afternoon",
  },
  {
    id: "closure-positive",
    title: "Encerre com algo positivo",
    description: "Antes de sair: relembre uma interação boa do dia.",
    category: "closure",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: "afternoon",
  },
  {
    id: "closure-tomorrow",
    title: "Escreva 1 meta pra amanhã",
    description: "Só uma. Objetiva. Seu eu de amanhã começa mais leve.",
    category: "closure",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "estado-do-dia",
    timeWindow: "afternoon",
  },
  {
    id: "closure-organize",
    title: "Organize sua mesa antes de sair",
    description: "Mesa limpa = mente leve. 2 minutos resolvem.",
    category: "closure",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "afternoon",
  },

  // ── Gym / Atividade Física (7) ──
  {
    id: "gym-walk-20",
    title: "Caminhada de 20 minutos",
    description: "No almoço ou após o expediente. Ritmo livre, sem pressa.",
    category: "gym",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "gym-stretch-deep",
    title: "10 minutos de alongamento",
    description: "Pernas, costas, quadril. Seu corpo sente o dia acumular.",
    category: "gym",
    difficulty: "medium",
    points: 8,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "afternoon",
  },
  {
    id: "gym-bodyweight",
    title: "Série rápida sem equipamento",
    description: "10 agachamentos, 10 flexões, 30s prancha. Onde estiver.",
    category: "gym",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "gym-yoga",
    title: "5 posturas de yoga",
    description: "Cachorro olhando pra baixo, guerreiro, árvore. Básico e poderoso.",
    category: "gym",
    difficulty: "medium",
    points: 8,
    preferredStates: ["partly-cloudy", "protective-cloud"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "gym-dance",
    title: "Dance uma música inteira",
    description: "Escolha uma que goste. Sozinho, sem julgamento. Mexa-se.",
    category: "gym",
    difficulty: "simple",
    points: 5,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "gym-outdoor",
    title: "Exercício ao ar livre",
    description: "Corrida leve, bicicleta ou caminhada no parque. Sol + movimento.",
    category: "gym",
    difficulty: "medium",
    points: 8,
    preferredStates: ["clear"],
    targetDomain: "recarga",
    timeWindow: null,
  },
  {
    id: "gym-breathing-exercise",
    title: "Exercício de respiração ativa",
    description: "5 respirações rápidas + 1 longa. Repita 3 vezes. Ativa o corpo.",
    category: "gym",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "recarga",
    timeWindow: "morning",
  },

  // ── Social (6) ──
  {
    id: "social-call-colleague",
    title: "Ligue para um colega",
    description: "Sem assunto de trabalho. Pergunte como está, de verdade.",
    category: "social",
    difficulty: "support",
    points: 6,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "social-lunch-group",
    title: "Almoce com alguém",
    description: "Convide um colega para almoçar junto. Conexão nutre.",
    category: "social",
    difficulty: "support",
    points: 6,
    preferredStates: ["clear"],
    targetDomain: "seguranca-relacional",
    timeWindow: "morning",
  },
  {
    id: "social-compliment",
    title: "Elogie alguém pessoalmente",
    description: "Diga algo genuíno que você admira na pessoa. Olho no olho.",
    category: "social",
    difficulty: "support",
    points: 6,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "social-checkin-msg",
    title: "Mande um 'como você tá?'",
    description: "Mensagem curta, sincera. Alguém pode precisar disso hoje.",
    category: "social",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "social-share-something",
    title: "Compartilhe algo que te inspirou",
    description: "Um artigo, vídeo ou frase. Espalhar inspiração conecta.",
    category: "social",
    difficulty: "simple",
    points: 5,
    preferredStates: ["clear", "partly-cloudy"],
    targetDomain: "seguranca-relacional",
    timeWindow: null,
  },
  {
    id: "social-thank-you",
    title: "Agradeça um colega por algo",
    description: "Pode ser simples: 'valeu por me ajudar com aquilo.'",
    category: "social",
    difficulty: "simple",
    points: 5,
    preferredStates: [],
    targetDomain: "seguranca-relacional",
    timeWindow: "afternoon",
  },
];

// ── Scoring rules ─────────────────────────────────
export { POINT_VALUES } from "@shared/constants";

// ── Selection engine ──────────────────────────────

interface SelectionContext {
  skyState: SkyState;
  domainScores: Record<ScoreDomainId, number>;
  flags: string[];
  recentMissionIds: string[];
}

function dayseed(): number {
  const dateStr = devNow().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = Math.trunc((hash << 5) - hash + (dateStr.codePointAt(i) ?? 0));
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.trunc(s);
    s = Math.trunc(s + 0x6d2b79f5);
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function respiroFactor(difficulty: MissionTemplate["difficulty"]): number {
  if (difficulty === "medium") return 0.4;
  if (difficulty === "support") return 0.2;
  return 1;
}

function computeWeight(mission: MissionTemplate, ctx: SelectionContext): number {
  let weight = 1;

  if (mission.preferredStates.length === 0) {
    weight += 0.5;
  } else if (mission.preferredStates.includes(ctx.skyState)) {
    weight += 2;
  } else {
    weight *= 0.3;
  }

  if (mission.targetDomain) {
    const score = ctx.domainScores[mission.targetDomain] ?? 50;
    if (score < 40) weight += 1.5;
    else if (score < 60) weight += 0.5;
  }

  const hour = devNow().getHours();
  if (mission.timeWindow === "morning" && hour >= 14) weight *= 0.2;
  if (mission.timeWindow === "afternoon" && hour < 11) weight *= 0.2;

  if (ctx.recentMissionIds.includes(mission.id)) {
    weight *= 0.15;
  }

  if (ctx.skyState === "respiro") {
    weight *= respiroFactor(mission.difficulty);
  }

  return Math.max(weight, 0.01);
}

export function selectMissions(ctx: SelectionContext): SelectedMission[] {
  const rand = seededRandom(dayHash(ctx));
  const count = ctx.skyState === "respiro" ? 2 : 4;

  const weighted = MISSION_POOL.map((m) => ({
    mission: m,
    weight: computeWeight(m, ctx),
  }));

  const selected: MissionTemplate[] = [];
  const usedCategories = new Set<MissionCategory>();

  for (let pick = 0; pick < count; pick++) {
    const available = weighted.filter(
      (w) =>
        !selected.includes(w.mission) &&
        (pick >= 3 || !usedCategories.has(w.mission.category)),
    );

    if (available.length === 0) break;

    const totalWeight = available.reduce((s, w) => s + w.weight, 0);
    let roll = rand() * totalWeight;

    let chosen = available[0].mission;
    for (const w of available) {
      roll -= w.weight;
      if (roll <= 0) {
        chosen = w.mission;
        break;
      }
    }

    selected.push(chosen);
    usedCategories.add(chosen.category);
  }

  return selected.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    points: m.points,
    category: m.category,
  }));
}

function skyStateToInt(skyState: string): number {
  if (skyState === "clear") return 1;
  if (skyState === "partly-cloudy") return 2;
  if (skyState === "protective-cloud") return 3;
  return 4;
}

function dayHash(ctx: SelectionContext): number {
  const base = dayseed();
  const stateVal = skyStateToInt(ctx.skyState);
  return base ^ (stateVal * 7919);
}

export function getMissionPoolSize(): number {
  return MISSION_POOL.length;
}
