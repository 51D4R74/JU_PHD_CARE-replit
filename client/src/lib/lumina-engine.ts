/**
 * Lumina message engine — selects contextual messages for the LuminaCard.
 *
 * AI sprint: swap `selectLuminaMessage` with a real RAG/GenAI call.
 * The exported function signature MUST remain stable so pages never need
 * to change when the underlying implementation is upgraded to a live model.
 */

export type LuminaContext =
  | "dashboard"
  | "dashboard-low"
  | "support"
  | "missions"
  | "journey";

export interface LuminaMessage {
  readonly text: string;
  readonly cta: string;
}

// Multiple message variants per context — stable daily rotation keeps
// the companion feeling fresh without real-time AI inference.
const MESSAGES: Record<LuminaContext, readonly LuminaMessage[]> = {
  dashboard: [
    {
      text: "Vi seus sinais de hoje — quer conversar sobre o que notei?",
      cta: "Falar com JuPHD Care",
    },
    {
      text: "Como foi até agora? Quero entender melhor o seu momento.",
      cta: "Contar pra JuPHD Care",
    },
    {
      text: "Algo chamou minha atenção hoje. Posso compartilhar?",
      cta: "Quero ouvir",
    },
  ],
  "dashboard-low": [
    {
      text: "Percebi algo no seu dia que merece atenção. Posso te ouvir se quiser.",
      cta: "Conversar agora",
    },
    {
      text: "Notei um sinal de atenção no seu momento. Estou aqui.",
      cta: "Falar agora",
    },
  ],
  support: [
    {
      text: "Posso sugerir algo com base no que você tem vivido?",
      cta: "Pedir uma sugestão",
    },
    {
      text: "Às vezes um olhar de fora ajuda. Quer a minha perspectiva?",
      cta: "Sim, me ajuda",
    },
    {
      text: "Tenho algumas ideias para o seu momento atual.",
      cta: "Me conta",
    },
  ],
  missions: [
    {
      text: "Escolhi essas missões pensando no seu momento. Quer entender por quê?",
      cta: "Me explica",
    },
    {
      text: "Cada missão aqui foi escolhida para o seu momento atual.",
      cta: "Quero saber mais",
    },
  ],
  journey: [
    {
      text: "Quer que eu interprete o padrão dos seus últimos dias?",
      cta: "Interpretar pra mim",
    },
    {
      text: "Percebi algo interessante no seu momento. Quer ver o que notei?",
      cta: "Me mostra",
    },
    {
      text: "Vi uma tendência ao longo dos seus dias. Quer conversar sobre ela?",
      cta: "Sim, vamos ver",
    },
  ],
};

/**
 * Returns the Lumina message for a given context.
 * Rotates daily so the companion feels fresh across sessions.
 *
 * AI sprint: replace this function body with a RAG inference call.
 */
export function selectLuminaMessage(context: LuminaContext): LuminaMessage {
  const variants = MESSAGES[context];
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return variants[dayIndex % variants.length];
}
