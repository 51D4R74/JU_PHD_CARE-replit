import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, PieChart, Pie,
} from "recharts";
import {
  Shield, Warning, TrendUp, UsersThree, Activity, Brain,
  SignOut, ChartBar, Flame, Bell,
  Trophy, Heart, Percent,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import RHAggregateCard from "@/components/rh-aggregate-card";
import { fetchCurrentChallenge, buildOfflineSnapshot, type TeamChallengeSnapshot } from "@/lib/team-challenge-engine";

// ── Aggregate data types (match API contract) ─────

interface DomainAverage {
  domain: string;
  label: string;
  avg: number;
}

interface DeptAggregate {
  department: string;
  headcount: number;
  participationRate: number; // 0–100
  domainAverages: DomainAverage[];
  riskLevel: "low" | "medium" | "high";
  stressIndex: number;     // 0–100
  burnoutIndex: number;    // 0–100
}

interface AggregateAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  department: string;
  timestamp: string; // relative time
}

interface RHAggregateData {
  departments: DeptAggregate[];
  alerts: AggregateAlert[];
  participation: number; // overall 0–100
  totalCollaborators: number;
  activeCollaborators: number;
  averageWellbeing: number; // 0–100
  trendBurnout: { month: string; value: number | null; forecast: number | null }[];
  moodDistribution: { name: string; value: number; color: string }[];
}

// ── Helpers ────────────────────────────────────────

function participationColor(rate: number) {
  if (rate >= 85) return "bg-score-good";
  if (rate >= 70) return "bg-score-moderate";
  return "bg-score-attention";
}

function domainTierClass(avg: number) {
  if (avg >= 75) return "bg-score-good/15 text-score-good border-score-good/20";
  if (avg >= 50) return "bg-score-moderate/15 text-score-moderate border-score-moderate/20";
  if (avg >= 25) return "bg-score-attention/15 text-score-attention border-score-attention/20";
  return "bg-score-critical/15 text-score-critical border-score-critical/20";
}

function getRiskColor(level: string) {
  if (level === "high") return "text-score-critical bg-score-critical/10 border-score-critical/20";
  if (level === "medium") return "text-score-moderate bg-score-moderate/10 border-score-moderate/20";
  return "text-score-good bg-score-good/10 border-score-good/20";
}

function getRiskLabel(level: string) {
  if (level === "high") return "Atenção alta";
  if (level === "medium") return "Atenção moderada";
  return "Acompanhamento";
}

function getSeverityBorder(s: string) {
  if (s === "high") return "border-l-score-critical";
  if (s === "medium") return "border-l-score-moderate";
  return "border-l-score-good";
}

function ChartTooltip({
  active,
  payload,
  label,
}: Readonly<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border-soft rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────

export default function RHDashboardPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data, isPending, isError } = useQuery<RHAggregateData>({
    queryKey: ["/api/rh/aggregate"],
  });
  const { data: teamChallenge = buildOfflineSnapshot() } = useQuery<TeamChallengeSnapshot>({
    queryKey: ["/api/team-challenges/current"],
    queryFn: fetchCurrentChallenge,
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-surface-warm flex items-center justify-center px-6">
        <div className="rounded-xl border border-border-soft bg-white px-5 py-4 text-sm text-muted-foreground">
          Carregando visão agregada do RH...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-surface-warm flex items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-score-critical/20 bg-white px-5 py-4 text-sm text-muted-foreground">
          Não foi possível carregar os indicadores agregados agora. Tente novamente em instantes.
        </div>
      </div>
    );
  }

  // Chart data for department stress/burnout comparison
  const deptChartData = data.departments.map((d) => ({
    department: d.department,
    stress: d.stressIndex,
    burnout: d.burnoutIndex,
    satisfaction: 100 - d.stressIndex, // derived inverse for visualization
  }));

  return (
    <div className="min-h-screen bg-surface-warm">
      {/* Header */}
      <header className="border-b border-border-soft bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-navy flex items-center justify-center">
              <ChartBar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">JuPHD — Painel RH</h1>
              <p className="text-xs text-muted-foreground">Visão Organizacional Agregada</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
              data-testid="button-notifications"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              {data.alerts.some((a) => a.severity === "high") && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-score-critical rounded-full" />
              )}
            </button>
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <button
              onClick={() => { void logout(); navigate("/"); }}
              className="p-2 rounded-lg hover:bg-black/5 transition-colors text-muted-foreground"
              data-testid="button-rh-logout"
            >
              <SignOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <RHAggregateCard
            icon={<UsersThree className="w-5 h-5 text-brand-teal" />}
            label="Colaboradores Ativos"
            value={`${data.activeCollaborators}/${data.totalCollaborators}`}
            subtitle={`${data.participation}% de participação`}
            trend={{ direction: "up", value: "+8%" }}
            trendPositive="up"
            delay={0}
          />
          <RHAggregateCard
            icon={<Brain className="w-5 h-5 text-score-good" />}
            label="Leitura Agregada Recente"
            value={`${data.averageWellbeing}%`}
            subtitle="Média recente dos 3 domínios"
            trend={{ direction: "up", value: "+5%" }}
            trendPositive="up"
            delay={0.05}
          />
          <RHAggregateCard
            icon={<Flame className="w-5 h-5 text-score-attention" />}
            label="Áreas em Atenção"
            value={data.departments.filter((d) => d.riskLevel === "high").length}
            subtitle={`de ${data.departments.length} monitorados`}
            trend={{ direction: "down", value: "-1" }}
            trendPositive="down"
            delay={0.1}
          />
          <RHAggregateCard
            icon={<Activity className="w-5 h-5 text-brand-navy" />}
            label="Alertas Ativos"
            value={data.alerts.length}
            subtitle={`${data.alerts.filter((a) => a.severity === "high").length} alta severidade`}
            delay={0.15}
          />
        </div>

        {/* Team challenge summary for RH */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border-soft bg-white p-5 mb-8 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-brand-gold-dark" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Desafio Coletivo: {teamChallenge.template.title}</h3>
            <p className="text-xs text-muted-foreground">
              {teamChallenge.progressPct}% concluído · {teamChallenge.daysRemaining} dias restantes · {teamChallenge.progress}/{teamChallenge.template.target} {teamChallenge.template.unit}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-brand-gold-dark">{teamChallenge.progressPct}%</p>
          </div>
        </motion.div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Department stress/burnout chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 rounded-xl border border-border-soft bg-white p-6"
          >
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Flame className="w-4 h-4 text-score-attention" />
              Sinais Agregados por Departamento
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Proxies de estresse e desgaste agregado para triagem organizacional
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 11, fill: "#5E6D7C" }}
                  axisLine={{ stroke: "#DDD8D2" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5E6D7C" }}
                  axisLine={{ stroke: "#DDD8D2" }}
                  domain={[0, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="stress" name="Proxy de estresse" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="burnout" name="Desgaste agregado" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Mood distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border-soft bg-white p-6"
          >
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Heart className="w-4 h-4 text-brand-teal" />
              Distribuição de Humor
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Últimos 30 dias — agregado</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.moodDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.moodDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid hsl(var(--border-soft))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {data.moodDistribution.map((m) => (
                <div key={m.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-muted-foreground">{m.name} ({m.value}%)</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Second row: burnout trend + participation by department */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Burnout trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-2 rounded-xl border border-border-soft bg-white p-6"
          >
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <TrendUp className="w-4 h-4 text-score-moderate" weight="bold" />
              Tendência de Desgaste Agregado
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Tendência exploratória baseada em sinais agregados recentes
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.trendBurnout}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#5E6D7C" }}
                  axisLine={{ stroke: "#DDD8D2" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5E6D7C" }}
                  axisLine={{ stroke: "#DDD8D2" }}
                  domain={[0, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Atual"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 3 }}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="forecast"
                  name="Projeção exploratória"
                  stroke="#f87171"
                  fill="#f87171"
                  fillOpacity={0.05}
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={{ fill: "#f87171", r: 3 }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Participation by department */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border-soft bg-white p-6"
          >
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Percent className="w-4 h-4 text-brand-navy" />
              Participação por Área
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Taxa de check-in — últimos 30 dias
            </p>
            <div className="space-y-3">
              {data.departments.map((dept) => (
                <div key={dept.department} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{dept.department}</span>
                    <span className="text-xs text-muted-foreground">{dept.participationRate}%</span>
                  </div>
                  <div className="h-2 bg-surface-warm rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dept.participationRate}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className={`h-full rounded-full ${participationColor(dept.participationRate)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Risk level by department + domain averages */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk classification */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-border-soft bg-white p-6"
          >
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-score-critical" />
              Nível de Atenção por Área
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Classificação operacional baseada em sinais agregados</p>
            <div className="space-y-3">
              {data.departments.map((dept) => (
                <div
                  key={dept.department}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-warm/80"
                  data-testid={`risk-dept-${dept.department}`}
                >
                  <div>
                    <p className="text-sm font-medium">{dept.department}</p>
                    <p className="text-xs text-muted-foreground">
                      {dept.headcount} pessoas · Estresse: {dept.stressIndex}%
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${getRiskColor(dept.riskLevel)}`}>
                    {getRiskLabel(dept.riskLevel)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Domain averages by department */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border-soft bg-white p-6"
          >
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <ChartBar className="w-4 h-4 text-brand-teal" />
              Médias por Domínio
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Recarga · Estado do dia · Segurança relacional</p>
            <div className="space-y-4">
              {data.departments.map((dept) => (
                <div key={dept.department}>
                  <p className="text-xs font-medium mb-2">{dept.department}</p>
                  <div className="flex gap-2">
                    {dept.domainAverages.map((da) => {
                      const tier = domainTierClass(da.avg);
                      return (
                        <div
                          key={da.domain}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${tier}`}
                        >
                          <p className="text-[10px] font-medium truncate">{da.label}</p>
                          <p className="text-sm font-bold">{da.avg}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-xl border border-border-soft bg-white p-6"
        >
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Warning className="w-4 h-4 text-score-moderate" />
            Alertas de Atenção Organizacional
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Triagem automatizada de padrões agregados para aprofundamento organizacional
          </p>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg bg-surface-warm/60 border-l-2 ${getSeverityBorder(alert.severity)}`}
                data-testid={`alert-${alert.severity}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {alert.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Privacy footer */}
        <div className="mt-6 text-center pb-8">
          <p className="text-[10px] text-muted-foreground/50 max-w-md mx-auto leading-relaxed">
            Este painel exibe apenas dados agregados. Nenhum colaborador individual
            é identificado. Taxas de participação são percentuais por departamento,
            sem nomes ou IDs.
          </p>
        </div>
      </main>
    </div>
  );
}
