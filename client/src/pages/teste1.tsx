import { Bell, Cloud, Settings, Sparkles, Sun, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HeroVariant = Readonly<{
  id: string;
  title: string;
  summary: string;
  rationale: string;
  contentClassName: string;
  headlineClassName: string;
  streakClassName: string;
  imageClassName?: string;
}>;

const HERO_IMAGE_SRC = "/sky/sol-04.webp";

const HERO_VARIANTS: readonly HeroVariant[] = [
  {
    id: "opcao-1",
    title: "Opção 1",
    summary: "Centro alto com bloco unido",
    rationale: "Mantém o hero emocional, mas tira a saudação do eixo mais agressivo do sol e aproxima o título do card de constância.",
    contentClassName: "items-center pt-28 text-center",
    headlineClassName: "max-w-[12ch] text-center text-[clamp(1.9rem,5vw,2.8rem)]",
    streakClassName: "mt-5",
    imageClassName: "object-center object-[center_58%]",
  },
  {
    id: "opcao-2",
    title: "Opção 2",
    summary: "Coluna à esquerda, mais produto",
    rationale: "É a opção mais forte para produto: cria eixo claro, respeita o fundo e para de deixar o texto flutuando no meio da imagem.",
    contentClassName: "items-start pt-24 text-left",
    headlineClassName: "max-w-[10ch] text-left text-[clamp(2rem,5vw,3rem)]",
    streakClassName: "mt-4 self-start",
  },
  {
    id: "opcao-3",
    title: "Opção 3",
    summary: "Faixa editorial com contraste controlado",
    rationale: "Minha escolha extra: mantém impacto visual do céu, mas coloca a mensagem dentro de uma faixa legível e deliberada, sem depender da sorte da foto.",
    contentClassName: "items-center justify-end pb-24 text-center",
    headlineClassName: "max-w-[12ch] rounded-[28px] bg-slate-950/28 px-5 py-4 text-center text-[clamp(1.9rem,5vw,2.7rem)] backdrop-blur-md",
    streakClassName: "mt-4 rounded-full bg-white/86 px-3 py-2 shadow-lg shadow-slate-950/10",
  },
] as const;

const WEEK_DAYS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

function CompactBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/15 bg-white/96 px-3 py-1.5 shadow-sm shadow-slate-950/10">
      <Sun className="h-3.5 w-3.5 fill-brand-gold text-brand-gold-dark" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Lumens</span>
      <span className="text-sm font-bold text-slate-900">0</span>
    </div>
  );
}

function DayStreak() {
  return (
    <div className="inline-flex items-center gap-3 rounded-[24px] bg-white/90 px-4 py-3 shadow-lg shadow-slate-950/10 backdrop-blur-sm">
      {WEEK_DAYS.map((day, index) => (
        <div key={`${day}-${index}`} className="flex w-5 flex-col items-center gap-1">
          <span className="text-[11px] font-semibold text-slate-400">{day}</span>
          <span className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white" />
        </div>
      ))}
    </div>
  );
}

function DomainPills() {
  const pills = [
    { label: "Energia", Icon: Zap, color: "text-amber-300" },
    { label: "Dia", Icon: Sun, color: "text-yellow-300" },
    { label: "Clima", Icon: Cloud, color: "text-sky-300" },
  ] as const;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex gap-2 px-3 pb-3">
      {pills.map(({ label, Icon, color }) => (
        <div key={label} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-stone-700/55 px-3 py-2 backdrop-blur-md">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-[10px] font-semibold tracking-wide text-white/92">{label}</span>
        </div>
      ))}
    </div>
  );
}

function HeroMock({ variant }: Readonly<{ variant: HeroVariant }>) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/40 bg-card shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
      <div className="relative min-h-[420px] overflow-hidden bg-slate-950">
        <img
          src={HERO_IMAGE_SRC}
          alt="Hero com céu e sol"
          width={640}
          height={640}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${variant.imageClassName ?? ""}`}
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/24 via-transparent to-slate-950/42" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%)]" aria-hidden="true" />

        <div className="relative z-10 flex items-start justify-between px-4 pt-4">
          <CompactBadge />
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full bg-white/95 p-2 text-slate-500 shadow-sm" aria-label="Notificações">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-full bg-white/95 p-2 text-slate-500 shadow-sm" aria-label="Configurações">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`relative z-10 flex min-h-[320px] flex-col px-6 sm:px-8 ${variant.contentClassName}`}>
          <h2 className={`${variant.headlineClassName} text-balance font-semibold leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_16px_rgba(15,23,42,0.4)]`}>
            Bom dia, Teo
          </h2>
          <div className={variant.streakClassName}>
            <DayStreak />
          </div>
        </div>

        <DomainPills />
      </div>
    </div>
  );
}

export default function Teste1Page() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--surface-warm))_100%)]">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-teal/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-teal shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Teste 1
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Três caminhos para reposicionar a saudação do hero
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            As três opções abaixo usam a mesma imagem e o mesmo badge do topo. O objetivo aqui não é inventar outro produto, é comparar composição, legibilidade e autoridade visual.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {HERO_VARIANTS.map((variant) => (
            <Card key={variant.id} className="overflow-hidden border-border/60 bg-white/82 shadow-sm backdrop-blur-sm">
              <CardHeader className="space-y-2 border-b border-border/50 bg-white/78">
                <CardTitle className="text-xl text-foreground">{variant.title}</CardTitle>
                <CardDescription className="text-sm font-medium text-brand-navy">{variant.summary}</CardDescription>
                <p className="text-sm leading-6 text-muted-foreground">{variant.rationale}</p>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <HeroMock variant={variant} />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}