# M0 — Foundation

**Epic:** Adapt existing codebase to new product model
**Sprints:** S1–S2 (4 weeks)
**Priority:** 🔴 Critical — blocks all subsequent milestones
**Labels:** `milestone:m0` `priority:critical` `type:foundation`

---

## Goal

Replace the 3-moment EMA check-in with a single daily check-in. Build the visual foundation (SkyHeader, ScoreCard, design tokens) that every future screen depends on. No new features — only reshape what exists.

---

## Success criteria

- [ ] New check-in flow (6 questions) works end-to-end with mock backend
- [ ] `SkyHeader` renders 4 distinct visual states driven by `skyState` prop
- [ ] `ScoreCard` renders score (0–100) with expandable contributors list
- [ ] `OneTapMood` bottom sheet captures mood in 1 tap, optional follow-up in 2 taps
- [ ] Client-side score engine computes Recarga, Estado do dia, Segurança relacional
- [ ] Design tokens for 4 sky states defined in Tailwind config
- [ ] `npm run check` passes clean
- [ ] No regressions in login, auth, or routing

---

## Sprint 1 — Data model + visual primitives

| # | Task | Type | Est |
| - | ---- | ---- | --- |
| 1 | Refactor `checkin-data.ts`: new single check-in model (6 questions from proposal), replacing 3-moment EMA structure | Data | 4h |
| 2 | Define design tokens for 4 sky states (clear / partly cloudy / protective cloud / Modo Respiro) in `tailwind.config.ts` | Design | 2h |
| 3 | `SkyHeader` component — animated, derives from `animated-brand-logo.tsx`, accepts `skyState` + `solarHaloLevel` props | Component | 6h |
| 4 | `ScoreCard` component — generic card with title, score 0–100, contributors list, expandable | Component | 3h |

**Sprint 1 definition of done:** Components render in isolation (storybook or test page). Design tokens applied. Check-in data model compiles.

## Sprint 2 — Check-in flow + microcheck + score engine

| # | Task | Type | Est |
| - | ---- | ---- | --- |
| 5 | Rewrite `checkin.tsx`: 6-question flow, local scoring, optional tags, slide animations preserved | Page | 8h |
| 6 | `OneTapMood` bottom sheet — 4 options (Seguindo bem / Tenso / Sem energia / Preciso de apoio), conditional follow-up | Component | 4h |
| 7 | `client/src/lib/score-engine.ts` — compute Recarga, Estado do dia, Segurança relacional from check-in answers | Lib | 4h |

**Sprint 2 definition of done:** User can complete full check-in flow. Scores compute locally. OneTapMood captures response. All data persists to localStorage as stub.

---

## API dependency

| Endpoint | Needed by | Contract |
| -------- | --------- | -------- |
| `POST /api/checkins` | S2 | `{ answers: Record<string, string[]>, tags?: string[], timestamp: string }` → `{ id, scores }` |

Until backend delivers, frontend uses localStorage persistence.

---

## Risks

| Risk | Impact | Mitigation |
| ------ | -------- | ------------ |
| Killing 3-moment EMA is irreversible | Loses granularity of morning/midday/evening data | Confirm with product owner before S1 starts |
| Score engine weights are undefined | Arbitrary numbers produce meaningless scores | Start with equal weights, flag as `// DEBT: calibrate weights with clinical input` |
| SkyHeader animation performance | Heavy animation on low-end devices | Profile on throttled CPU; degrade to static if > 16ms frame budget |

---

## Files touched

| File | Action |
| ------ | -------- |
| `client/src/lib/checkin-data.ts` | Rewrite — new question model |
| `client/src/pages/checkin.tsx` | Rewrite — single check-in flow |
| `client/src/lib/score-engine.ts` | Create — client-side score computation |
| `client/src/components/sky-header.tsx` | Create — animated header |
| `client/src/components/score-card.tsx` | Create — score display card |
| `client/src/components/one-tap-mood.tsx` | Create — microcheck bottom sheet |
| `tailwind.config.ts` | Edit — add sky state tokens |
