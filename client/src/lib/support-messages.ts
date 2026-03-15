/**
 * Curated support message library.
 *
 * 40+ messages across 4 categories: calma, coragem, acolhimento, leveza.
 * Tags link messages to specific risk flags from checkin-data.
 *
 * BACKLOG: moderation pipeline needed before enabling community messages [future milestone]
 */

export type SupportCategory = "calma" | "coragem" | "acolhimento" | "leveza";

export interface SupportMessage {
  id: string;
  category: SupportCategory;
  text: string;
  tags: string[];
}

export const SUPPORT_CATEGORIES: {
  id: SupportCategory;
  label: string;
  emoji: string;
  description: string;
}[] = [
  { id: "calma", label: "Calma", emoji: "🌊", description: "Mensagens para desacelerar" },
  { id: "coragem", label: "Coragem", emoji: "🔥", description: "Força para seguir em frente" },
  { id: "acolhimento", label: "Acolhimento", emoji: "🫂", description: "Abraços em palavras" },
  { id: "leveza", label: "Leveza", emoji: "🍃", description: "Um sopro de leveza" },
];

export const SUPPORT_MESSAGES: SupportMessage[] = [
  // ── Calma (10) ──────────────────────────────────
  { id: "calm-001", category: "calma", text: "Hoje não precisa dar conta de tudo.", tags: ["overload", "general"] },
  { id: "calm-002", category: "calma", text: "Respira. Esse momento passa.", tags: ["general"] },
  { id: "calm-003", category: "calma", text: "Você não precisa resolver tudo agora. Uma coisa de cada vez.", tags: ["overload", "workload"] },
  { id: "calm-004", category: "calma", text: "Desacelerar não é parar. É escolher o ritmo certo.", tags: ["general"] },
  { id: "calm-005", category: "calma", text: "Está tudo bem não ter respostas ainda. Elas vêm.", tags: ["general"] },
  { id: "calm-006", category: "calma", text: "Feche os olhos por 10 segundos. O mundo espera.", tags: ["general"] },
  { id: "calm-007", category: "calma", text: "Uma respiração profunda já muda a química do seu corpo.", tags: ["general"] },
  { id: "calm-008", category: "calma", text: "Seus sentimentos são válidos. Você tem direito de senti-los.", tags: ["general", "personal"] },
  { id: "calm-009", category: "calma", text: "Não precisa fingir que está tudo bem. Aqui é seguro.", tags: ["general"] },
  { id: "calm-010", category: "calma", text: "O cansaço também é informação. Ouça o que ele diz.", tags: ["overload", "health"] },

  // ── Coragem (10) ────────────────────────────────
  { id: "courage-001", category: "coragem", text: "Você já passou por coisas difíceis antes. E está aqui.", tags: ["general"] },
  { id: "courage-002", category: "coragem", text: "Pedir ajuda é força, não fraqueza.", tags: ["general", "peer_risk"] },
  { id: "courage-003", category: "coragem", text: "Cada pequeno passo conta. Mesmo os invisíveis.", tags: ["general"] },
  { id: "courage-004", category: "coragem", text: "Ter coragem não exige perfeição.", tags: ["general"] },
  { id: "courage-005", category: "coragem", text: "O medo é natural. Agir mesmo com medo — isso é coragem.", tags: ["general"] },
  { id: "courage-006", category: "coragem", text: "Dizer 'não' quando precisa é uma das coisas mais corajosas.", tags: ["workload", "leadership_risk"] },
  { id: "courage-007", category: "coragem", text: "Você não está só nessa jornada.", tags: ["general", "peer_risk"] },
  { id: "courage-008", category: "coragem", text: "Seu valor não depende do que produziu hoje.", tags: ["overload", "workload"] },
  { id: "courage-009", category: "coragem", text: "Ter limite é sinal de maturidade, não de fraqueza.", tags: ["general", "workload"] },
  { id: "courage-010", category: "coragem", text: "Quem cuida de si cuida melhor dos outros também.", tags: ["general"] },

  // ── Acolhimento (10) ────────────────────────────
  { id: "warmth-001", category: "acolhimento", text: "Você importa. Mesmo quando não sente isso.", tags: ["general"] },
  { id: "warmth-002", category: "acolhimento", text: "Dias difíceis não definem quem você é.", tags: ["general"] },
  { id: "warmth-003", category: "acolhimento", text: "Está tudo bem precisar de um colo hoje.", tags: ["general", "personal"] },
  { id: "warmth-004", category: "acolhimento", text: "Suas dores merecem atenção, não pressa.", tags: ["general"] },
  { id: "warmth-005", category: "acolhimento", text: "Alguém torce por você mesmo quando você não percebe.", tags: ["general", "peer_risk"] },
  { id: "warmth-006", category: "acolhimento", text: "Você fez o melhor que pôde hoje. E isso basta.", tags: ["overload", "workload"] },
  { id: "warmth-007", category: "acolhimento", text: "O que pesa agora não precisa pesar para sempre.", tags: ["general"] },
  { id: "warmth-008", category: "acolhimento", text: "Sentir vulnerabilidade é parte de ser humano. Não é falha.", tags: ["general"] },
  { id: "warmth-009", category: "acolhimento", text: "Aqui não tem julgamento. Só tem espaço.", tags: ["general"] },
  { id: "warmth-010", category: "acolhimento", text: "Às vezes o melhor cuidado é descansar.", tags: ["overload", "health"] },

  // ── Leveza (11) ─────────────────────────────────
  { id: "light-001", category: "leveza", text: "Amanhã é outra chance. Sempre é.", tags: ["general"] },
  { id: "light-002", category: "leveza", text: "Nem tudo precisa ser urgente. Escolha o que pode esperar.", tags: ["overload", "workload"] },
  { id: "light-003", category: "leveza", text: "Um sorriso muda seu estado. Tenta — nem que seja um micro.", tags: ["general"] },
  { id: "light-004", category: "leveza", text: "Dê uma pausa. A produtividade agradece.", tags: ["workload"] },
  { id: "light-005", category: "leveza", text: "Ninguém nunca se arrependeu de respirar fundo.", tags: ["general"] },
  { id: "light-006", category: "leveza", text: "Se puder, olhe pela janela agora. Luz natural cura.", tags: ["general"] },
  { id: "light-007", category: "leveza", text: "O simples também é bonito. Beba água, respire, siga.", tags: ["general"] },
  { id: "light-008", category: "leveza", text: "Rir de si mesmo é uma superpotência. Use-a.", tags: ["general"] },
  { id: "light-009", category: "leveza", text: "Hoje pode ser um dia de apenas... ser.", tags: ["general"] },
  { id: "light-010", category: "leveza", text: "Diminua o zoom. Veja o todo. A vida é mais que esse momento.", tags: ["general"] },
  { id: "light-011", category: "leveza", text: "Não se cobra tanto. Você está fazendo bom trabalho.", tags: ["overload"] },

  // ── Reconhecimento & Autonomia (6) ──────────────
  { id: "courage-011", category: "coragem", text: "Trabalhar muito sem ver reconhecimento é desgastante. Seu esforço tem valor, mesmo quando ninguém diz.", tags: ["leadership_risk", "workload"] },
  { id: "courage-012", category: "coragem", text: "Você merece ter voz nas decisões que afetam o seu dia.", tags: ["leadership_risk"] },
  { id: "warmth-011", category: "acolhimento", text: "Se a escuta não está vindo de quem deveria, saiba que aqui ela existe.", tags: ["leadership_risk", "peer_risk"] },
  { id: "warmth-012", category: "acolhimento", text: "Sentir que ninguém nota o que você faz não é frescura. É um dado real sobre o ambiente.", tags: ["leadership_risk"] },
  { id: "calm-011", category: "calma", text: "A sobrecarga diz mais sobre o sistema do que sobre você. Não carregue a culpa do que é estrutural.", tags: ["overload", "workload"] },
  { id: "light-012", category: "leveza", text: "Autonomia se constrói aos poucos. Comece pelo limite mais simples de hoje.", tags: ["leadership_risk", "workload"] },
];
