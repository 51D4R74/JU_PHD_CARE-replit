import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, Building2, CreditCard, LogOut, Search, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AdminOverview {
  readonly totalTenants: number;
  readonly activeTenants: number;
  readonly totalPlans: number;
  readonly totalUsers: number;
  readonly btcTenants: number;
  readonly btbTenants: number;
  readonly btgTenants: number;
}

type TenantAudience = "btc" | "btb" | "btg";
type TenantStatus = "active" | "suspended" | "draft";

interface TenantPlan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly audience: TenantAudience;
  readonly description: string;
  readonly isolationProfile: string;
  readonly monthlyActiveUserLimit: number | null;
  readonly priceMonthlyUsdCents: number | null;
  readonly billingCycle: "monthly" | "annual" | null;
  readonly active: boolean;
}

interface TenantRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly audience: TenantAudience;
  readonly planCode: string;
  readonly status: TenantStatus;
  readonly billingEmail: string | null;
  readonly dataResidency: string | null;
}

interface AdminUserRecord {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly role: string;
  readonly department: string | null;
}

type TenantMembershipRole = "tenant_admin" | "tenant_analyst" | "tenant_viewer";

interface TenantMembershipRecord {
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipRole: TenantMembershipRole;
  readonly capabilities: string[];
  readonly active: boolean;
  readonly user: AdminUserRecord | null;
  readonly tenant: TenantRecord | null;
}

interface TenantFormState {
  readonly slug: string;
  readonly name: string;
  readonly audience: TenantAudience;
  readonly planCode: string;
  readonly billingEmail: string;
  readonly dataResidency: string;
}

interface MembershipFormState {
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipRole: TenantMembershipRole;
}

interface PlanFormState {
  readonly code: string;
  readonly name: string;
  readonly audience: TenantAudience;
  readonly description: string;
  readonly isolationProfile: string;
  readonly monthlyActiveUserLimit: string;
  readonly priceMonthlyUsdCents: string;
  readonly billingCycle: "monthly" | "annual" | "";
  readonly active: boolean;
}

type BillingPeriodStatus = "active" | "closed" | "overdue";

interface BillingPeriodRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly planCode: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly mauLimit: number | null;
  readonly mauUsed: number;
  readonly status: BillingPeriodStatus;
}

interface BillingPeriodFormState {
  readonly tenantId: string;
  readonly planCode: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly mauLimit: string;
}

const DEFAULT_FORM: TenantFormState = {
  slug: "",
  name: "",
  audience: "btb",
  planCode: "",
  billingEmail: "",
  dataResidency: "br-south-1",
};

const DEFAULT_MEMBERSHIP_FORM: MembershipFormState = {
  userId: "",
  tenantId: "",
  membershipRole: "tenant_analyst",
};

const DEFAULT_PLAN_FORM: PlanFormState = {
  code: "",
  name: "",
  audience: "btb",
  description: "",
  isolationProfile: "isolated-schema",
  monthlyActiveUserLimit: "",
  priceMonthlyUsdCents: "",
  billingCycle: "",
  active: true,
};

const DEFAULT_BILLING_FORM: BillingPeriodFormState = {
  tenantId: "",
  planCode: "",
  periodStart: "",
  periodEnd: "",
  mauLimit: "",
};

function audienceLabel(audience: TenantRecord["audience"] | TenantPlan["audience"]) {
  if (audience === "btc") return "BTC";
  if (audience === "btb") return "BTB";
  return "BTG";
}

function statusLabel(status: TenantRecord["status"]) {
  if (status === "active") return "Ativo";
  if (status === "suspended") return "Suspenso";
  return "Rascunho";
}

function statusBadgeClass(status: TenantRecord["status"]) {
  if (status === "active") return "bg-score-good/10 text-score-good border-score-good/20";
  if (status === "suspended") return "bg-score-critical/10 text-score-critical border-score-critical/20";
  return "bg-score-moderate/10 text-score-moderate border-score-moderate/20";
}

function audienceBadgeClass(audience: TenantRecord["audience"] | TenantPlan["audience"]) {
  if (audience === "btc") return "bg-brand-teal/10 text-brand-teal border-brand-teal/20";
  if (audience === "btb") return "bg-brand-navy/10 text-brand-navy border-brand-navy/20";
  return "bg-brand-gold/15 text-brand-gold-dark border-brand-gold/30";
}

function membershipRoleLabel(role: TenantMembershipRole) {
  if (role === "tenant_admin") return "Admin do tenant";
  if (role === "tenant_analyst") return "Analista";
  return "Leitor";
}

function capabilityLabel(capability: string) {
  if (capability === "control_plane:read") return "Leitura control plane";
  if (capability === "control_plane:write") return "Escrita control plane";
  if (capability === "tenant_memberships:write") return "Gestão de memberships";
  return capability;
}

function nextStatus(current: TenantStatus): TenantStatus {
  if (current === "draft") return "active";
  if (current === "active") return "suspended";
  return "active";
}

function nextStatusLabel(current: TenantStatus) {
  if (current === "draft") return "Ativar";
  if (current === "active") return "Suspender";
  return "Reativar";
}

function formatPrice(cents: number | null, cycle: "monthly" | "annual" | null): string {
  if (cents === null) return "Contrato personalizado";
  const usd = cents / 100;
  const formatted = usd.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
  if (cycle === "monthly") return `${formatted}/mês`;
  if (cycle === "annual") return `${formatted}/ano`;
  return formatted;
}

function mauUsagePercent(used: number, limit: number | null): number {
  if (!limit) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

function billingPeriodStatusLabel(status: BillingPeriodStatus): string {
  if (status === "active") return "Ativo";
  if (status === "overdue") return "Em atraso";
  return "Encerrado";
}

function billingPeriodStatusClass(status: BillingPeriodStatus): string {
  if (status === "active") return "bg-score-good/10 text-score-good border-score-good/20";
  if (status === "overdue") return "bg-score-critical/10 text-score-critical border-score-critical/20";
  return "bg-muted text-muted-foreground";
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TenantFormState>(DEFAULT_FORM);
  const [membershipForm, setMembershipForm] = useState<MembershipFormState>(DEFAULT_MEMBERSHIP_FORM);
  const [planForm, setPlanForm] = useState<PlanFormState>(DEFAULT_PLAN_FORM);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [billingForm, setBillingForm] = useState<BillingPeriodFormState>(DEFAULT_BILLING_FORM);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantAudienceFilter, setTenantAudienceFilter] = useState<"all" | TenantAudience>("all");
  const [tenantStatusFilter, setTenantStatusFilter] = useState<"all" | TenantStatus>("all");
  const [membershipSearch, setMembershipSearch] = useState("");

  const { data: overview } = useQuery<AdminOverview>({
    queryKey: ["/api/admin/overview"],
  });
  const { data: plans = [] } = useQuery<TenantPlan[]>({
    queryKey: ["/api/admin/tenant-plans"],
  });
  const { data: tenants = [] } = useQuery<TenantRecord[]>({
    queryKey: ["/api/admin/tenants"],
  });
  const { data: users = [] } = useQuery<AdminUserRecord[]>({
    queryKey: ["/api/admin/users"],
  });
  const { data: memberships = [] } = useQuery<TenantMembershipRecord[]>({
    queryKey: ["/api/admin/memberships"],
  });
  const { data: activeBillingPeriods = [] } = useQuery<BillingPeriodRecord[]>({
    queryKey: ["/api/admin/billing-periods"],
  });

  const createTenantMutation = useMutation({
    mutationFn: async (payload: TenantFormState) => {
      await apiRequest("POST", "/api/admin/tenants", {
        slug: payload.slug,
        name: payload.name,
        audience: payload.audience,
        planCode: payload.planCode,
        status: "draft",
        billingEmail: payload.billingEmail || null,
        dataResidency: payload.dataResidency || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] }),
      ]);
      setForm(DEFAULT_FORM);
      toast({ title: "Tenant criado", description: "O tenant entrou no control plane como rascunho." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível criar o tenant.";
      toast({ title: "Falha ao criar tenant", description: message, variant: "destructive" });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ id, status }: Readonly<{ id: string; status: TenantRecord["status"] }>) => {
      await apiRequest("PATCH", `/api/admin/tenants/${id}`, { status });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] }),
      ]);
      toast({ title: "Tenant atualizado", description: "O status do tenant foi atualizado." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o tenant.";
      toast({ title: "Falha ao atualizar tenant", description: message, variant: "destructive" });
    },
  });

  const upsertMembershipMutation = useMutation({
    mutationFn: async (payload: MembershipFormState) => {
      await apiRequest("POST", "/api/admin/memberships", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      setMembershipForm(DEFAULT_MEMBERSHIP_FORM);
      toast({ title: "Membership salvo", description: "O acesso do usuário ao tenant foi atualizado." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o membership.";
      toast({ title: "Falha ao salvar membership", description: message, variant: "destructive" });
    },
  });

  const updateMembershipMutation = useMutation({
    mutationFn: async ({ userId, tenantId, active }: Readonly<{ userId: string; tenantId: string; active: boolean }>) => {
      await apiRequest("PATCH", `/api/admin/memberships/${tenantId}/${userId}`, { active });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      toast({ title: "Membership atualizado", description: "O status do membership foi alterado." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o membership.";
      toast({ title: "Falha ao atualizar membership", description: message, variant: "destructive" });
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: async (payload: PlanFormState) => {
      const body = {
        ...(editingPlanId ? {} : { code: payload.code.trim() }),
        name: payload.name.trim(),
        audience: payload.audience,
        description: payload.description.trim(),
        isolationProfile: payload.isolationProfile.trim(),
        monthlyActiveUserLimit: payload.monthlyActiveUserLimit.trim()
          ? Number.parseInt(payload.monthlyActiveUserLimit, 10)
          : null,
        priceMonthlyUsdCents: payload.priceMonthlyUsdCents.trim()
          ? Number.parseInt(payload.priceMonthlyUsdCents, 10)
          : null,
        billingCycle: payload.billingCycle || null,
        active: payload.active,
      };

      if (editingPlanId) {
        await apiRequest("PATCH", `/api/admin/tenant-plans/${editingPlanId}`, body);
        return;
      }

      await apiRequest("POST", "/api/admin/tenant-plans", body);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant-plans"] }),
      ]);
      setPlanForm(DEFAULT_PLAN_FORM);
      setEditingPlanId(null);
      toast({
        title: editingPlanId ? "Plano atualizado" : "Plano criado",
        description: editingPlanId ? "O catálogo foi atualizado com sucesso." : "O plano entrou no catálogo do control plane.",
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o plano.";
      toast({ title: "Falha ao salvar plano", description: message, variant: "destructive" });
    },
  });

  const publishPlanMutation = useMutation({
    mutationFn: async ({ id, active }: Readonly<{ id: string; active: boolean }>) => {
      await apiRequest("PATCH", `/api/admin/tenant-plans/${id}`, { active });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant-plans"] }),
      ]);
      toast({ title: "Plano atualizado", description: "O status de publicação do plano foi alterado." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o plano.";
      toast({ title: "Falha ao atualizar plano", description: message, variant: "destructive" });
    },
  });

  const createBillingPeriodMutation = useMutation({
    mutationFn: async (payload: BillingPeriodFormState) => {
      await apiRequest("POST", "/api/admin/billing-periods", {
        tenantId: payload.tenantId,
        planCode: payload.planCode,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        mauLimit: payload.mauLimit ? Number.parseInt(payload.mauLimit, 10) : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-periods"] });
      setBillingForm(DEFAULT_BILLING_FORM);
      toast({ title: "Período criado", description: "O período de cobrança entrou como ativo. O anterior foi encerrado automaticamente." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível criar o período de cobrança.";
      toast({ title: "Falha ao criar período", description: message, variant: "destructive" });
    },
  });

  const updateBillingUsageMutation = useMutation({
    mutationFn: async ({ id, mauUsed }: Readonly<{ id: string; mauUsed: number }>) => {
      await apiRequest("PATCH", `/api/admin/billing-periods/${id}/usage`, { mauUsed });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-periods"] });
      toast({ title: "Uso atualizado", description: "O contador de MAU do período foi atualizado." });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o uso.";
      toast({ title: "Falha ao atualizar uso", description: message, variant: "destructive" });
    },
  });

  function submitTenant() {
    const hasMinimumData = form.slug.trim() && form.name.trim() && form.planCode;
    if (hasMinimumData) {
      createTenantMutation.mutate(form);
      return;
    }

    toast({
      title: "Dados incompletos",
      description: "Preencha slug, nome e plano antes de criar o tenant.",
      variant: "destructive",
    });
  }

  function submitMembership() {
    const hasMinimumData = membershipForm.userId && membershipForm.tenantId;
    if (hasMinimumData) {
      upsertMembershipMutation.mutate(membershipForm);
      return;
    }

    toast({
      title: "Dados incompletos",
      description: "Selecione usuário, tenant e papel antes de salvar o membership.",
      variant: "destructive",
    });
  }

  function submitPlan() {
    const hasMinimumData = planForm.name.trim() && planForm.description.trim() && planForm.isolationProfile.trim();
    const hasCode = editingPlanId ? true : planForm.code.trim();
    if (hasMinimumData && hasCode) {
      savePlanMutation.mutate(planForm);
      return;
    }

    toast({
      title: "Dados incompletos",
      description: "Preencha código, nome, descrição e perfil de isolamento antes de salvar o plano.",
      variant: "destructive",
    });
  }

  function editPlan(plan: TenantPlan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      audience: plan.audience,
      description: plan.description,
      isolationProfile: plan.isolationProfile,
      monthlyActiveUserLimit: plan.monthlyActiveUserLimit === null ? "" : String(plan.monthlyActiveUserLimit),
      priceMonthlyUsdCents: plan.priceMonthlyUsdCents === null ? "" : String(plan.priceMonthlyUsdCents),
      billingCycle: plan.billingCycle ?? "",
      active: plan.active,
    });
  }

  function resetPlanForm() {
    setEditingPlanId(null);
    setPlanForm(DEFAULT_PLAN_FORM);
  }

  const allowedPlans = plans.filter((plan) => plan.audience === form.audience && plan.active);
  const controlPlaneWritable = user?.role === "rh" || user?.capabilities.includes("control_plane:write") === true;
  const membershipCapable = user?.role === "rh" || user?.capabilities.includes("tenant_memberships:write") === true;

  const filteredTenants = tenants.filter((tenant) => {
    const searchLower = tenantSearch.toLowerCase();
    const matchesSearch =
      tenantSearch === "" ||
      tenant.name.toLowerCase().includes(searchLower) ||
      tenant.slug.toLowerCase().includes(searchLower);
    const matchesAudience = tenantAudienceFilter === "all" || tenant.audience === tenantAudienceFilter;
    const matchesStatus = tenantStatusFilter === "all" || tenant.status === tenantStatusFilter;
    return matchesSearch && matchesAudience && matchesStatus;
  });

  const filteredMemberships = memberships.filter((m) => {
    if (membershipSearch === "") return true;
    const searchLower = membershipSearch.toLowerCase();
    return (
      (m.user?.name ?? "").toLowerCase().includes(searchLower) ||
      (m.tenant?.name ?? "").toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-surface-warm">
      <header className="sticky top-0 z-20 border-b border-border-soft bg-white/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/rh")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Lumina Control Plane</h1>
              <p className="text-xs text-muted-foreground">Tenants, planos e fundação do admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <button
              type="button"
              onClick={() => {
                void logout();
                navigate("/");
              }}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <Card>
            <CardHeader>
              <CardDescription>Tenants registrados</CardDescription>
              <CardTitle>{overview?.totalTenants ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Tenants ativos</CardDescription>
              <CardTitle>{overview?.activeTenants ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Planos publicados</CardDescription>
              <CardTitle>{overview?.totalPlans ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Usuários no ambiente atual</CardDescription>
              <CardTitle>{overview?.totalUsers ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tenants</CardTitle>
                <CardDescription>
                  Gerencie os tenants registrados no control plane. Use os filtros para localizar rapidamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8 h-9"
                      placeholder="Buscar por nome ou slug…"
                      value={tenantSearch}
                      onChange={(event) => setTenantSearch(event.target.value)}
                    />
                  </div>
                  <Select
                    value={tenantAudienceFilter}
                    onValueChange={(v) => setTenantAudienceFilter(v as "all" | TenantAudience)}
                  >
                    <SelectTrigger className="h-9 w-[110px]">
                      <SelectValue placeholder="Segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="btc">BTC</SelectItem>
                      <SelectItem value="btb">BTB</SelectItem>
                      <SelectItem value="btg">BTG</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={tenantStatusFilter}
                    onValueChange={(v) => setTenantStatusFilter(v as "all" | TenantStatus)}
                  >
                    <SelectTrigger className="h-9 w-[120px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{filteredTenants.length} de {tenants.length}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Residência</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{tenant.name}</span>
                            <span className="text-xs text-muted-foreground">/{tenant.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={audienceBadgeClass(tenant.audience)}>
                            {audienceLabel(tenant.audience)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{tenant.planCode}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(tenant.status)}>
                            {statusLabel(tenant.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{tenant.dataResidency ?? "n/d"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updateTenantMutation.isPending || !controlPlaneWritable}
                            onClick={() => updateTenantMutation.mutate({ id: tenant.id, status: nextStatus(tenant.status) })}
                          >
                            {nextStatusLabel(tenant.status)}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Criar tenant</CardTitle>
                <CardDescription>
                  Use isso para provisionar um cliente novo no control plane. O tenant nasce em rascunho para evitar ativação prematura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Nome do tenant</Label>
                  <Input
                    id="tenant-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ex: Prefeitura de Belo Horizonte"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-slug">Slug</Label>
                  <Input
                    id="tenant-slug"
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))}
                    placeholder="prefeitura-bh"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select
                      value={form.audience}
                      onValueChange={(value: TenantFormState["audience"]) => {
                        setForm((current) => ({
                          ...current,
                          audience: value,
                          planCode: "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="btc">BTC</SelectItem>
                        <SelectItem value="btb">BTB</SelectItem>
                        <SelectItem value="btg">BTG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select
                      value={form.planCode}
                      onValueChange={(value) => setForm((current) => ({ ...current, planCode: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedPlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.code}>{plan.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-billing">E-mail financeiro</Label>
                    <Input
                      id="tenant-billing"
                      type="email"
                      value={form.billingEmail}
                      onChange={(event) => setForm((current) => ({ ...current, billingEmail: event.target.value }))}
                      placeholder="billing@cliente.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenant-residency">Residência de dados</Label>
                    <Input
                      id="tenant-residency"
                      value={form.dataResidency}
                      onChange={(event) => setForm((current) => ({ ...current, dataResidency: event.target.value }))}
                      placeholder="br-south-1"
                    />
                  </div>
                </div>
                <Button type="button" className="w-full bg-brand-navy hover:bg-brand-navy-hover" disabled={createTenantMutation.isPending || !controlPlaneWritable} onClick={submitTenant}>
                  Criar tenant
                </Button>
                {!controlPlaneWritable && (
                  <p className="text-xs text-score-critical">Sua conta pode ler o control plane, mas não pode criar ou alterar tenants.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Memberships e capability auth</CardTitle>
                <CardDescription>
                  O admin agora usa membership por tenant e capabilities explícitas. A autenticação segue JWT próprio em cookie httpOnly, sem Cognito.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border-soft bg-white p-4">
                  <p className="text-sm font-medium text-foreground">Seu acesso atual</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(user?.capabilities ?? []).map((capability) => (
                      <Badge key={capability} variant="outline" className="bg-brand-navy/5 text-brand-navy border-brand-navy/20">
                        {capabilityLabel(capability)}
                      </Badge>
                    ))}
                    {(user?.capabilities ?? []).length === 0 && (
                      <span className="text-sm text-muted-foreground">Sem capabilities explícitas. Acesso herdado apenas por role.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select
                    value={membershipForm.userId}
                    onValueChange={(value) => setMembershipForm((current) => ({ ...current, userId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((adminUser) => (
                        <SelectItem key={adminUser.id} value={adminUser.id}>
                          {adminUser.name} · {adminUser.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tenant</Label>
                    <Select
                      value={membershipForm.tenantId}
                      onValueChange={(value) => setMembershipForm((current) => ({ ...current, tenantId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      value={membershipForm.membershipRole}
                      onValueChange={(value: TenantMembershipRole) => setMembershipForm((current) => ({ ...current, membershipRole: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um papel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tenant_admin">Admin do tenant</SelectItem>
                        <SelectItem value="tenant_analyst">Analista</SelectItem>
                        <SelectItem value="tenant_viewer">Leitor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full bg-brand-navy hover:bg-brand-navy-hover"
                  disabled={upsertMembershipMutation.isPending || !membershipCapable}
                  onClick={submitMembership}
                >
                  Salvar membership
                </Button>

                {!membershipCapable && (
                  <p className="text-xs text-score-critical">
                    Sua conta consegue ler o control plane, mas não pode alterar memberships.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Memberships ativos</CardTitle>
                <CardDescription>
                  O acesso deixa de depender só de role global e passa a ser concedido por tenant com capabilities explícitas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9"
                    placeholder="Buscar por nome ou tenant…"
                    value={membershipSearch}
                    onChange={(event) => setMembershipSearch(event.target.value)}
                  />
                </div>
                {filteredMemberships.map((membership) => (
                  <div key={`${membership.userId}-${membership.tenantId}`} className="rounded-xl border border-border-soft bg-white p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy">
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{membership.user?.name ?? membership.userId}</p>
                          <p className="text-xs text-muted-foreground">{membership.tenant?.name ?? membership.tenantId}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={membership.active ? "bg-score-good/10 text-score-good border-score-good/20" : "bg-score-critical/10 text-score-critical border-score-critical/20"}>
                        {membership.active ? "Ativo" : "Suspenso"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{membershipRoleLabel(membership.membershipRole)}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {membership.capabilities.map((capability) => (
                        <span key={capability} className="rounded-full bg-muted px-2 py-1">{capabilityLabel(capability)}</span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={updateMembershipMutation.isPending || !membershipCapable}
                      onClick={() => updateMembershipMutation.mutate({
                        userId: membership.userId,
                        tenantId: membership.tenantId,
                        active: !membership.active,
                      })}
                    >
                      {membership.active ? "Suspender acesso" : "Reativar acesso"}
                    </Button>
                  </div>
                ))}
                {filteredMemberships.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum membership encontrado.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Governança de planos</CardTitle>
                <CardDescription>
                  O catálogo agora é administrável no próprio control plane. Código é imutável depois da criação para preservar rastreabilidade contratual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plan-code">Código</Label>
                    <Input
                      id="plan-code"
                      value={planForm.code}
                      disabled={editingPlanId !== null}
                      onChange={(event) => setPlanForm((current) => ({ ...current, code: event.target.value.toLowerCase() }))}
                      placeholder="btb-scale-plus"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-name">Nome do plano</Label>
                    <Input
                      id="plan-name"
                      value={planForm.name}
                      onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="BTB Scale Plus"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select
                      value={planForm.audience}
                      disabled={editingPlanId !== null}
                      onValueChange={(value: TenantAudience) => setPlanForm((current) => ({ ...current, audience: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="btc">BTC</SelectItem>
                        <SelectItem value="btb">BTB</SelectItem>
                        <SelectItem value="btg">BTG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-limit">Limite MAU</Label>
                    <Input
                      id="plan-limit"
                      inputMode="numeric"
                      value={planForm.monthlyActiveUserLimit}
                      onChange={(event) => setPlanForm((current) => ({ ...current, monthlyActiveUserLimit: event.target.value }))}
                      placeholder="250000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-isolation">Perfil de isolamento</Label>
                  <Input
                    id="plan-isolation"
                    value={planForm.isolationProfile}
                    onChange={(event) => setPlanForm((current) => ({ ...current, isolationProfile: event.target.value }))}
                    placeholder="isolated-schema"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-description">Descrição</Label>
                  <textarea
                    id="plan-description"
                    value={planForm.description}
                    onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Plano corporativo com controles ampliados e governança operacional reforçada."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plan-price">Preço (USD cents)</Label>
                    <Input
                      id="plan-price"
                      inputMode="numeric"
                      value={planForm.priceMonthlyUsdCents}
                      onChange={(event) => setPlanForm((current) => ({ ...current, priceMonthlyUsdCents: event.target.value }))}
                      placeholder="14900 = US$ 149,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciclo de cobrança</Label>
                    <Select
                      value={planForm.billingCycle}
                      onValueChange={(value: PlanFormState["billingCycle"]) => setPlanForm((current) => ({ ...current, billingCycle: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem ciclo fixo</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    className="flex-1 bg-brand-navy hover:bg-brand-navy-hover"
                    disabled={savePlanMutation.isPending || !controlPlaneWritable}
                    onClick={submitPlan}
                  >
                    {editingPlanId ? "Salvar alterações" : "Criar plano"}
                  </Button>
                  {editingPlanId && (
                    <Button type="button" variant="outline" onClick={resetPlanForm}>
                      Cancelar
                    </Button>
                  )}
                </div>

                {!controlPlaneWritable && (
                  <p className="text-xs text-score-critical">Sua conta não pode alterar o catálogo de planos.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Catálogo de planos</CardTitle>
                <CardDescription>
                  O catálogo separa BTC, BTB e BTG, preserva código imutável e permite despublicação segura quando o plano não está em uso ativo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-border-soft bg-white p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy">
                          <BarChart3 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.code}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={audienceBadgeClass(plan.audience)}>
                        {audienceLabel(plan.audience)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-1">isolamento: {plan.isolationProfile}</span>
                      <span className={`rounded-full px-2 py-1 ${plan.active ? "bg-score-good/10 text-score-good" : "bg-score-critical/10 text-score-critical"}`}>
                        {plan.active ? "publicado" : "despublicado"}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1">
                        limite MAU: {plan.monthlyActiveUserLimit ?? "sob demanda"}
                      </span>
                      <span className="rounded-full bg-brand-teal/10 text-brand-teal px-2 py-1">
                        <CreditCard className="inline h-3 w-3 mr-1" />
                        {formatPrice(plan.priceMonthlyUsdCents, plan.billingCycle)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={!controlPlaneWritable} onClick={() => editPlan(plan)}>
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={publishPlanMutation.isPending || !controlPlaneWritable}
                        onClick={() => publishPlanMutation.mutate({ id: plan.id, active: !plan.active })}
                      >
                        {plan.active ? "Despublicar" : "Publicar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Períodos de cobrança ativos</CardTitle>
                <CardDescription>
                  Um período ativo por tenant. Criar um novo período encerra automaticamente o anterior, preservando rastreabilidade histórica.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeBillingPeriods.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum período de cobrança ativo registrado.</p>
                )}
                {activeBillingPeriods.map((period) => {
                  const pct = mauUsagePercent(period.mauUsed, period.mauLimit);
                  return (
                    <div key={period.id} className="rounded-xl border border-border-soft bg-white p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{period.tenantId}</p>
                            <p className="text-xs text-muted-foreground">{period.planCode} &middot; {period.periodStart} → {period.periodEnd}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={billingPeriodStatusClass(period.status)}>
                          {billingPeriodStatusLabel(period.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-score-critical" : pct >= 70 ? "bg-score-fair" : "bg-score-good"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {period.mauUsed.toLocaleString("pt-BR")} / {period.mauLimit?.toLocaleString("pt-BR") ?? "∞"} MAU ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-xl border border-dashed border-border-soft p-4 space-y-4">
                  <p className="text-sm font-medium text-foreground">Criar novo período</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tenant</Label>
                      <Select
                        value={billingForm.tenantId}
                        onValueChange={(v) => setBillingForm((c) => ({ ...c, tenantId: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o tenant" /></SelectTrigger>
                        <SelectContent>
                          {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bp-plan">Código do plano</Label>
                      <Input
                        id="bp-plan"
                        value={billingForm.planCode}
                        onChange={(e) => setBillingForm((c) => ({ ...c, planCode: e.target.value }))}
                        placeholder="btb-scale"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="bp-start">Início</Label>
                      <Input id="bp-start" type="date" value={billingForm.periodStart} onChange={(e) => setBillingForm((c) => ({ ...c, periodStart: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bp-end">Fim</Label>
                      <Input id="bp-end" type="date" value={billingForm.periodEnd} onChange={(e) => setBillingForm((c) => ({ ...c, periodEnd: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bp-mau">Limite MAU</Label>
                      <Input
                        id="bp-mau"
                        inputMode="numeric"
                        value={billingForm.mauLimit}
                        onChange={(e) => setBillingForm((c) => ({ ...c, mauLimit: e.target.value }))}
                        placeholder="250000"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-brand-navy hover:bg-brand-navy-hover"
                    disabled={createBillingPeriodMutation.isPending || !controlPlaneWritable}
                    onClick={() => createBillingPeriodMutation.mutate(billingForm)}
                  >
                    Criar período
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leitura técnica</CardTitle>
                <CardDescription>
                  Este slice entregou billing e metering de MAU com rastreabilidade histórica. Faturamento, notificações de limite e isolamento físico são os próximos cortes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 text-brand-teal" />
                  <p>Tenants, planos, memberships e períodos de cobrança já são governados no control plane com invariante de período único ativo por tenant.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 text-brand-gold-dark" />
                  <p>JWT próprio com cookie httpOnly continua sendo a estratégia oficial; Cognito permanece fora do escopo atual para evitar dívida e migração prematura.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="mt-0.5 h-4 w-4 text-brand-teal" />
                  <p>Billing period tracking registra MAU contratado vs. consumido por período, habilitando alertas e estorono como próximo slice.</p>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
