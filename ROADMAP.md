# JUPHD Care — Product Roadmap

**Last updated:** 2026-03-12
**Owner:** @51D4R74
**Status:** In execution — product surface delivered, core backend convergence in progress

---

## Vision

Daily self-care companion + organizational psychosocial risk radar.
Two products in one: personal well-being tool (collaborator) + aggregate analytics sensor (HR).

## Guiding principles

1. **Sky ≠ Halo** — Emotional state and self-care consistency are independent variables.
2. **Score what matters** — Points reward care, constancy, and support. Never emotion, never reporting.
3. **Compassionate by default** — No punitive streaks, no rankings, no shame mechanics.
4. **Privacy-first** — HR sees aggregates, never individual nominal data.
5. **Web-first** — Ship as PWA. Native decision deferred post-validation.

---

## Milestones

| Milestone | Sprints | Goal | Success criteria |
| --------- | ------- | ---- | ---------------- |
| **M0 — Foundation** | S1–S2 | Adapt existing code to new product model | New check-in flow works e2e with mock backend; SkyHeader renders 4 visual states; ScoreCard displays 3 domains |
| **M1 — Daily Loop** | S3–S4 | Core loop functional: check-in → scores → missions → points | User completes check-in, sees updated scores, receives 3–4 missions, earns Solar Points — all in one session |
| **M2 — Support & Protection** | S5–S6 | Support layer live: curated messages, Modo Respiro, microchecks | User in distress can receive support message, activate Modo Respiro, and complete simplified mission set |
| **M3 — History & Discoveries** | S7–S8 | User sees evolution over time; tags generate private correlations | User with 14+ days of data sees at least 1 discovery; weekly report renders correctly |
| **M4 — Collective** | S9–S10 | Team challenges and aggregate progress visible | Team mission shows real-time aggregate progress; RH dashboard displays live aggregate data |
| **M5 — Polish & Onboarding** | S11–S12 | Product-complete for internal pilot | New user understands product in ≤ 60s onboarding; E2E tests cover critical paths; bundle < 300 KB gzipped |

## Sprint cadence

- **Duration:** 2 weeks per sprint
- **Demo:** End of each sprint, working software
- **Backlog:** `.github/issues/M{n}-*.md`

## Current execution focus

| Sprint slice | Scope | Exit criteria |
| ------------ | ----- | ------------- |
| **S13 — Core Data Convergence** ✅ | Align daily check-in contract, score snapshot, RH aggregate API, and core pages | `POST /api/checkins`, `GET /api/scores/user/:id/today`, and `GET /api/rh/aggregate` running against shared storage contract |
| **S14 — Loop Persistence** ✅ | Move missions and settings off local-only state; server-side persistence with typed API | `GET/POST /api/missions/:userId/today`, `GET/PATCH /api/users/:id/settings` — missions survive reload, settings sync cross-device |
| **S15 — History Hardening** ✅ | Temporal aggregates and discoveries from server-side check-in history; report data server-canonical | `GET /api/checkins/user/:id/history` live; meu-cuidado + report no longer depend on isolated browser state |
| **S16 — Production Database** ✅ | Replace in-memory store with PostgreSQL via Drizzle ORM; zero-downtime swap via `IStorage` abstraction | `DrizzleStorage` passes all IStorage contracts; `DATABASE_URL` toggles backend; `npm run db:push` seeds schema |
| **S17 — Dashboard & Points Convergence** ✅ | Core pages read scores, missions, and constancy from server queries; eliminate remaining localStorage reads for canonical data | dashboard, missions, support, meu-cuidado, report all derive state from `useQuery`; Solar Points computed from server truth; ConstancyDots accepts server history; stale DEBT comments updated |
| **S18 — Write-Path Purification** ✅ | Eliminate localStorage dual-writes; remove dead code from score-engine + points-ledger; all check-in data flows server-only | `checkin.tsx` uses pure `computeCheckInResult` (no localStorage); `SolarPointsBadge` requires `points` prop (no fallback); `ConstancyDots` requires `checkedInDates` (no fallback); `score-engine.ts` zero localStorage; `points-ledger.ts` deprecated |
| **S19 — Auth Middleware & Route Protection** ✅ | Server-side session management, auth middleware on all routes, rate limiting on auth endpoints | `express-session` with httpOnly cookies; `requireAuth`, `requireOwner`, `requireRole` middleware in `server/middleware.ts`; all 20+ routes protected; `express-rate-limit` on login/register; `POST /api/auth/logout` + `GET /api/auth/me`; client validates session on mount |
| **S20 — Buyer-Ready Hardening** ✅ | Zero DEBT, zero `any`, zero cspell; PT-BR compliance; a11y; dedup DOMAIN_COLORS; STATUS-REPORT rewrite; benchmark document | `grep DEBT: → 0`; `grep ': any' → 0`; `npm run check → 0`; `npx cspell → 0`; not-found.tsx PT-BR; insight-card + team-progress-arc aria-labels; DOMAIN_COLORS in score-engine.ts; STATUS-REPORT reflects S13–S20; `benchmark-mental-health-apps.md` created |
| **S21 — Deep Quality Hardening** ✅ | Zero bare catches; typed error handling everywhere; runtime-validated JSON.parse; magic numbers extracted; server layer PT-BR; design token compliance | `grep 'catch {' → 0`; all catch blocks typed `(e: unknown)` with `console.warn`; `storage.ts` validates parsed JSON shape; `TREND_THRESHOLD` + `API_SYNC_DEBOUNCE_MS` named constants; `server/static.ts` PT-BR + `node:` prefix; `mission-card` uses CSS variable `hsl(var(--score-good))`; 16 files, 50 insertions |
| **S22 — PRD v2.0 Core** ✅ | Solar Points schema + API; IRP formula; ICE momentânea; stepped care; chatbot drawer UI; inline check-in on dashboard | Solar Points tables, 7 new endpoints, `shared/constants.ts`, chatbot drawer, inline progressive check-in |
| **S23 — UX Backlog Sweep** ✅ | B01–B08, B10, B13 — inline check-in, score states, celebration, constancy, time-aware Q1, first-visit welcome, crisis layout, team language, panic FAB | All B-items P0/P1 closed; panic button visible on all authenticated pages |
| **S24 — Feature Completeness** ✅ | Day boundary enforcement (04:00); k-anonymity filter on RH aggregate (n≥5); halo metrics wired to SkyHeader; OneTapMood FAB (post-check-in); confidence score on submission; B09 Solar tooltip; B11 micro-pulse; B12 merge CTA cards | `DAY_BOUNDARY_HOUR` + `ANONYMITY_THRESHOLD` active in server; `haloMetrics` prop flowing to SkyHeader; mood FAB live after check-in; `confidence` field sent on submit |
| **S25 — Data Continuity** ✅ | Team challenge persistence (localStorage → PostgreSQL); baseline status endpoint; `/checkin` route redirect to dashboard | `teamChallengeContributions` table in schema; `GET /api/team-challenges/current` + `POST /api/team-challenges/:id/contribute`; `GET /api/users/:id/baseline-status`; `shared/challenges.ts` single source of truth; `team-challenge-engine.ts` fully async; `team-challenge.tsx` uses React Query + useMutation |
| **S26 — Soul & Companion** ✅ | IIB emotional-design layer + Lumina AI companion card on every screen; retire all SonarLint errors and DEBT markers | Narrative domain tiles (`getDomainNarrative`); breathing orb (`companion-breathing`); area chart gradient wash; proportional tag cloud; constancy milestone halos; `LuminaCard` on dashboard / meu-cuidado / support / missions; `lumina-engine.ts` with daily-rotating variants and stable function signature for GenAI sprint; zero SonarLint errors; zero DEBT markers |
| **S27 — Auth Hardening & PRD Conformance** ✅ | JWT session auth hardening; PRD §4.5 survey interval correction; email domain allowlist; change-password endpoint + settings UI | `PULSE_SURVEY_INTERVAL_DAYS` corrected 30→45 (PRD §4.5 Goldilocks constraint); `ALLOWED_EMAIL_DOMAINS` env-var domain allowlist on `POST /api/auth/register`; `updateUserPassword` in `IStorage` + `MemStorage` + `DrizzleStorage`; `POST /api/auth/change-password` (verify current → bcrypt → re-issue JWT); change-password section in settings UI with eye-toggle inputs and inline feedback; `npm run check → 0` |
| **S28 — Capability Admin Foundation** ✅ | Fechar control plane com memberships por tenant, capability auth e documentação explícita da decisão JWT sem Cognito | `tenantMemberships` em `shared/schema.ts`; capabilities derivadas por papel (`tenant_admin`, `tenant_analyst`, `tenant_viewer`); `IStorage` + `MemStorage` + `DrizzleStorage` suportam membership e lookup de capabilities; `/api/admin/*` passa a aceitar capability além de `role`; `/api/admin/users` e `/api/admin/memberships` entregues; `auth/me` devolve capabilities; `/admin` protegido por capability no cliente; login e redirect suportam contas capability-first; README e instruções internas deixam explícito que o produto segue em JWT próprio sem Cognito |
| **S29 — Plan Catalog Governance** ✅ | Tornar o catálogo de planos administrável no control plane, com publicação segura e remoção de artefatos mortos | `createTenantPlanSchema` + `updateTenantPlanSchema`; `getTenantPlan` + `updateTenantPlan` em `IStorage`, `MemStorage` e `DrizzleStorage`; `POST/PATCH /api/admin/tenant-plans/*`; compatibilidade rígida entre `tenant.audience` e `plan.audience`; bloqueio de despublicação quando há tenant ativo usando o plano; `/admin` com formulário de criar/editar plano e status `publicado/despublicado`; `client/src/pages/teste1.tsx` removido do repositório |
| **S30 — Billing Contracts & Usage Metering + Admin UX** ✅ | Amarrar billing e limites contratuais ao catálogo de planos; metering de MAU por período; busca, filtro e paginação na tela de admin; fechar resíduo de CSP/fontes | `billingCycleSchema` + `billingPeriodStatusSchema` em `shared/schema.ts`; `priceMonthlyUsdCents` + `billingCycle` adicionados a `tenantPlans`; nova tabela `billingPeriods` com rastreabilidade histórica; `createBillingPeriodSchema` + `updateBillingPeriodUsageSchema`; `getTenantBillingPeriods`, `getActiveBillingPeriod`, `createBillingPeriod`, `updateBillingPeriodUsage` em `IStorage`, `MemStorage` e `DrizzleStorage`; `GET/POST /api/admin/billing-periods` + `PATCH /api/admin/billing-periods/:id/usage`; invariante de período ativo único por tenant (auto-fechamento do anterior); busca + filtros de audiência/status em Tenants; busca em Memberships; preço nos cards do catálogo de planos; painel de períodos de cobrança com gauge de MAU; formulário de criação de período; CSP corrigido — `fonts.googleapis.com` em `styleSrc`, `fonts.gstatic.com` em `fontSrc`; `npm run check → 0` |
| **S31 — RH Pulse Aggregate + Dashboard Integration** ✅ | Implementar endpoint de agregação do pulse formal com k-anonimato e painel de visualização no dashboard RH | `RhPulseAggregate` + `RhPulseDimensionScores` em `shared/schema.ts`; `getRhPulseAggregate()` em `IStorage`, `BaseStorage`, `MemStorage` (janela 45 dias, threshold k=5, delta de tendência vs. ciclo anterior) e `DrizzleStorage` (queries paralelas via `Promise.all`); `GET /api/rh/pulses/aggregate` com `requireAuth + requireRole("rh")`; painel pulse no dashboard RH com gauge de participação, gate de k-anonimato, score geral, chip de tendência e grid 4 dimensões via `PULSE_DIMENSION_LABELS`; skeleton loading; `npm run check → 0` |
| **S32 — Security Hardening Closeout (G2 gate)** ✅ | Fechar o workstream G2 com auditoria formal de roles, conversão do padrão inline de assertiva de ownership e rate limiting em endpoints de escrita | SEC-06 auditado — frota de routes sem gaps de auth; SEC-07 — `assertBodyOwner(req, res, bodyUserId)` em `server/middleware.ts`, aplicado em `POST /api/checkins`, `POST /api/pulses`, `POST /api/moment-checkins`; SEC-08 — `writeLimiter` (30 req/min por usuário) aplicado em `POST /api/solar/award`, `POST /api/incidents`, `POST /api/support/escalate`, `POST /api/community-messages`; `DOCS/GOVERNANCE.md` criado com board canônico de workstreams, tranches, milestones e status; `npm run check → 0` |

---

## What ships when

```text
S1─S2          S3─S4          S5─S6          S7─S8          S9─S10        S11─S12
 M0              M1             M2             M3             M4            M5
Foundation     Daily Loop     Support        History        Collective    Polish

SkyHeader      Dashboard v2   SupportCenter  MeuCuidado    TeamChallenge Settings
ScoreCard      MissionCenter  Modo Respiro   Tags+Insight  CéuColetivo   Onboarding
Checkin v2     Pontos Solares Biblioteca     Reports       RH Dashboard  E2E Tests
OneTapMood     Mission Engine Microcheck     Discoveries   TeamProgress  Performance
ScoreEngine    Persistência   Proteção v2    Constância    Marcos        Cleanup
```

---

## Out of scope (deferred beyond M5)

| Feature | Reason | Revisit when |
| ------- | ------ | ------------ |
| LLM Advisor / Chatbot | AI infra cost undefined; needs clinical validation | Post-pilot, if engagement data supports it |
| Native push notifications | Requires service worker + permission UX + cross-browser testing | Post-M5, after in-app notifications prove useful |
| Audio support messages | Moderation pipeline is a separate engineering project | V2, if text-only messages show adoption |
| Calendar integration | Enterprise B2B scope, not MVP | V2, driven by sales feedback |
| Shareable report with public link | LGPD risk; requires legal review | Post legal sign-off |
| React Native migration | Platform decision deferred; web-first is pragmatic | Sprint 0 migration if mobile metrics demand it |

---

## Backend coordination checkpoints

Frontend uses local stubs (localStorage + mock data) until each backend delivery.

| Sprint | Backend must deliver | Status |
| ------ | ------------------- | ------ |
| S2 | API contract for new check-in (`POST /api/checkins` schema + endpoint) | Implemented in shared schema + MemStorage |
| S3 | `GET /api/scores/user/:id/today` (even simplified calculation) | Implemented in shared storage snapshot |
| S4 | Missions CRUD + Solar Points ledger | Implemented: `GET/POST /api/missions/:userId/today`, missions persist server-side |
| S6 | Support messages CRUD + basic moderation flag | Deferred: messages are curated static content (ADR-004); no server CRUD needed |
| S8 | History aggregation queries + discovery data | Implemented: `GET /api/checkins/user/:id/history` — canonical history per user; discoveries computed client-side from server data (pure correlation, no server state needed) |
| S10 | Team challenges + RH aggregate endpoints | ✅ S25 — `teamChallengeContributions` table, `GET/POST /api/team-challenges/*`, `GET /api/users/:id/baseline-status` |

---

## Key metrics (post-launch)

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| D1 retention | ≥ 70% | Users who return day after first check-in |
| D7 retention | ≥ 40% | Users active 7 days after registration |
| D30 retention | ≥ 25% | Users active 30 days after registration |
| Check-in completion rate | ≥ 80% | Started check-ins that reach submission |
| Mission engagement | ≥ 50% | Users who complete ≥ 1 mission/day |
| Time to first value | ≤ 90s | Registration → first check-in submitted |
| Modo Respiro activation | Tracked | Users who enter Modo Respiro (no target — observation) |
| Support message usage | Tracked | Messages requested/day (no target — observation) |

---

## Architecture decision records

| ADR | Decision | Status |
| --- | -------- | ------ |
| ADR-001 | Replace 3-moment EMA with single daily check-in | Accepted |
| ADR-002 | Sky state and Solar Halo as independent visual layers | Accepted |
| ADR-003 | Client-side score engine with localStorage until backend ready | Accepted |
| ADR-004 | Curated message library before community moderation | Accepted |

---

## UX / Dashboard Backlog

Priority tiers: **P0** = blocks engagement, **P1** = high impact, **P2** = polish.

| # | Priority | Item | Notes |
| --- | --- | --- | --- |
| B01 | P0 | ~~**Inline progressive check-in on dashboard**~~ | ✅ S22 — done |
| B02 | P0 | ~~**Score card "no data" state (neutral/gray)**~~ | ✅ S23 — `hasData` prop, gray placeholder |
| B03 | P0 | ~~**Collapse scores before check-in**~~ | ✅ S22 — scores hidden until checkedIn |
| B04 | P1 | ~~**Post-check-in celebration micro-moment**~~ | ✅ S23 — spring animation on completion card, staggered score reveal |
| B05 | P1 | ~~**ConstancyDots visible on dashboard**~~ | ✅ S23 — wired below sky header with history query |
| B06 | P1 | ~~**Time-aware first question**~~ | ✅ S23 — `getTimeAwareSteps()` reorders by hour |
| B07 | P1 | ~~**First-visit warm welcome state**~~ | ✅ S23 — welcome card when history.length === 0 |
| B08 | P1 | ~~**Crisis-aware layout reordering**~~ | ✅ S23 — Support CTA above missions when score < 25 |
| B09 | P2 | ~~**Solar Points "0" contextual tooltip**~~ | ✅ S24 — TooltipProvider auto-shows on first visit, persistent dismiss to localStorage |
| B10 | P2 | ~~**Team Challenge human language**~~ | ✅ S23 — `describeChallenge()` helper |
| B11 | P2 | ~~**Micro-pulse OneTapMood integration**~~ | ✅ S24 — FAB visible after check-in, posts to `/api/moment-checkins` |
| B12 | P2 | ~~**Reduce vertical card count**~~ | ✅ S24 — Mission + Team Challenge merged into single "Atividades" glass-card |
| B13 | P0 | ~~**Panic button — always-visible FAB**~~ | ✅ S23 — fixed bottom-right ShieldAlert, 7 categories (Sobrecarga, Assédio, Reconhecimento, Saúde Mental, Liderança, Abuso, Segurança), anonymous reporting, visible on all authenticated pages |
