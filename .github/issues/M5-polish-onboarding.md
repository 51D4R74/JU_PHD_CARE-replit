# M5 — Polish & Onboarding

**Epic:** Product-complete for internal pilot
**Sprints:** S11–S12 (4 weeks)
**Priority:** 🟢 Medium — quality gate before pilot
**Labels:** `milestone:m5` `priority:medium` `type:polish`
**Depends on:** M0–M4 complete

---

## Goal

A new user understands the product in under 60 seconds. Settings work. Notifications exist in-app. Storybook pages are cleaned up. E2E tests cover critical paths. The product is ready for a real pilot with real people.

---

## Success criteria

- [ ] Onboarding flow explains scores + missions + points + sky/halo in ≤ 5 screens
- [ ] User completes onboarding → first check-in in ≤ 90 seconds
- [ ] Settings page: notification preferences (opt-in, time window, quiet hours, daily limit)
- [ ] In-app notification system: badge + drawer (not browser push — deferred)
- [ ] Storybook pages (1–6) removed from routes; useful design references archived in `DOCS/`
- [ ] E2E tests cover: registration → check-in → score → mission → complete → points
- [ ] `npm run build` produces bundle < 300 KB gzipped (main chunk)
- [ ] Lighthouse performance score ≥ 90 on dashboard page
- [ ] All routes lazy-loaded via `React.lazy` + `Suspense`
- [ ] `npm run check` passes clean — zero TypeScript errors

---

## Sprint 11 — Onboarding + settings + notifications

| # | Task | Type | Est |
| --- | ------ | ------ | ----- |
| 1 | Onboarding flow — 4–5 swipeable screens explaining: sky state, scores, missions, Solar Points, support | Component | 6h |
| 2 | First-run detection — show onboarding on first login, skip on subsequent sessions | Behavior | 1h |
| 3 | `Settings` page — notification preferences: opt-in toggles, time window picker, quiet hours, max notifications/day | Page | 5h |
| 4 | In-app notification system — notification badge in header, drawer with notification list (cuidado, missão, microcheck, apoio) | Component | 4h |
| 5 | Route `/settings` added to `App.tsx` | Routing | 1h |

**Sprint 11 definition of done:** New user sees onboarding. Settings persist to localStorage. Notification badge shows count. Drawer lists recent notifications.

## Sprint 12 — Cleanup + E2E + performance

| # | Task | Type | Est |
| --- | ------ | ------ | ----- |
| 6 | Remove storybook pages (1–6) from routes; archive color/typography specs to `DOCS/design-archive.md` | Cleanup | 2h |
| 7 | Lazy-load all routes via `React.lazy` + `Suspense` with loading skeleton | Performance | 3h |
| 8 | Bundle analysis — identify and tree-shake unused code; target < 300 KB gzipped | Performance | 3h |
| 9 | E2E tests — critical path: register → login → check-in → view scores → complete mission → earn points | Test | 8h |
| 10 | Lighthouse audit on dashboard, checkin, missions pages — fix anything below 90 | Performance | 2h |

**Sprint 12 definition of done:** All storybook routes removed. Bundle under target. E2E tests pass. Lighthouse ≥ 90. Product ready for pilot.

---

## Onboarding screens spec

| Screen | Content | Visual |
| -------- | --------- | -------- |
| 1 — Welcome | "Seu companheiro de autocuidado" + app logo animation | SkyHeader in clear state |
| 2 — Sky & Halo | "O céu mostra como você está. O halo mostra que você se cuida." | Side-by-side: cloudy sky with bright halo vs. clear sky with no halo |
| 3 — Scores | "Três dimensões do seu dia" — Recarga, Estado, Segurança | 3 ScoreCards preview |
| 4 — Missions | "Pequenas missões, grandes mudanças" — missions adapt to your state | MissionCard examples |
| 5 — Let's go | "Seu primeiro check-in leva menos de 1 minuto" + CTA | Arrow pointing to check-in |

## Notification types

| Type | Icon | Example |
| ------ | ------ | --------- |
| `care` | 💧 | "Hora de um gole d'água?" |
| `mission` | ⭐ | "Nova missão disponível" |
| `microcheck` | 💬 | "Como você está agora?" |
| `closure` | 🌅 | "Fechar seu dia leva menos de 20 segundos" |
| `support` | 🤝 | "Hoje talvez valha desacelerar" |

**Rules:**

- Max 3 in-app notifications/day
- Respect quiet hours setting
- No sensitive content in notification preview
- User can disable each type independently

---

## Storybook cleanup plan

| Page | Action |
| ------ | -------- |
| `storybook.tsx` (v0.2 dark) | Remove route. Archive palette to `DOCS/design-archive.md` |
| `storybook2.tsx` (v0.3 light) | Remove route. Archive palette |
| `storybook3.tsx` (wireframes) | Remove route. Already superseded by real pages |
| `storybook4.tsx` (Brand Horizon) | Remove route. Archive as chosen brand direction reference |
| `storybook5.tsx` (Quiet Sunrise) | Remove route. Delete — rejected variant |
| `storybook6.tsx` (Brand Horizon v2) | Remove route. Archive palette as secondary reference |

> Files stay in repo history via git. Remove from routes and `pages/` directory.

---

## E2E test plan

| Test | Flow | Assertions |
| ------ | ------ | ------------ |
| Registration | Fill form → submit → redirect to dashboard | User created, auth token set, dashboard renders |
| Login | Email + password → submit | Redirect to correct dashboard per role |
| Check-in complete | Open check-in → answer 6 questions → submit | Scores computed, data persisted, redirect to dashboard |
| Mission flow | View missions → tap complete → confirm | Points increase, mission marked done, constancy updates |
| Support flow | Open support → select category → receive message | Message displays, favorite toggle works |
| Modo Respiro | Trigger low state → verify UI changes | SkyHeader shifts, missions reduce, support CTA prominent |
| RH access | Login as RH → view dashboard | Aggregate data renders, no individual nominal data visible |

---

## Performance budget

| Metric | Target | Tool |
| -------- | -------- | ------ |
| Main bundle (gzipped) | < 300 KB | `vite-plugin-visualizer` |
| LCP | < 2.5s | Lighthouse |
| FID / INP | < 200ms | Lighthouse |
| CLS | < 0.1 | Lighthouse |
| TTI | < 3.5s | Lighthouse |

---

### Files touched

| File | Action |
| ---- | ------ |
| `client/src/components/onboarding.tsx` | Create |
| `client/src/pages/settings.tsx` | Create |
| `client/src/components/notification-drawer.tsx` | Create |
| `client/src/components/notification-badge.tsx` | Create |
| `client/src/App.tsx` | Edit — add routes, lazy-load all pages, remove storybook routes |
| `client/src/pages/storybook*.tsx` | Delete (6 files) |
| `DOCS/design-archive.md` | Create — archived design references |
