# M1 — Daily Loop

**Epic:** Core engagement loop — check-in → scores → missions → points
**Sprints:** S3–S4 (4 weeks)
**Priority:** 🔴 Critical — this is the product's heartbeat
**Labels:** `milestone:m1` `priority:critical` `type:feature`
**Depends on:** M0 complete

---

## Goal

The user does a check-in, sees three score cards, receives personalized missions, completes them, and earns Solar Points. The entire daily loop works in a single session. This is the minimum viable product loop.

---

## Success criteria

- [ ] Dashboard shows `SkyHeader` + 3 `ScoreCard` (Recarga, Estado do dia, Segurança relacional) with real computed data
- [ ] `MissionCenter` displays 3–4 missions adapted to user's current state
- [ ] User can complete a mission with single tap → animation → points awarded
- [ ] `SolarPointsBadge` in header shows accumulated points
- [ ] Last-10-days constancy indicator visible
- [ ] All data persists (localStorage until backend integration)
- [ ] State transitions work: stable → tense → Modo Respiro → each produces different mission set
- [ ] Zero-state: first-time user sees meaningful content before first check-in

---

## Sprint 3 — Dashboard redesign + mission UI

| # | Task | Type | Est |
| --- | ------ | ------ | ----- |
| 1 | Redesign `dashboard.tsx`: SkyHeader + 3 ScoreCards + check-in CTA + daily insight placeholder | Page | 8h |
| 2 | `MissionCard` component — icon, title, status (pending/done), points, tap-to-complete | Component | 3h |
| 3 | `MissionCenter` page — daily mission list, progress bar, Solar Points total | Page | 6h |
| 4 | Route `/missions` added to `App.tsx`, nav updated | Routing | 1h |

**Sprint 3 definition of done:** Dashboard renders with live score data from check-in. Mission center shows static mission list. Navigation between dashboard ↔ missions works.

## Sprint 4 — Mission engine + points + persistence

| # | Task | Type | Est |
| --- | ------ | ------ | ----- |
| 5 | `client/src/lib/mission-engine.ts` — selects 3–4 missions based on state (stable / tense / Modo Respiro), tags, time of day | Lib | 6h |
| 6 | `SolarPointsBadge` component — point display in header with subtle animation on increment | Component | 2h |
| 7 | Mission completion flow: tap → confirm → animation → points awarded → card updates | Interaction | 4h |
| 8 | localStorage persistence layer for points, missions, check-in history | Lib | 3h |
| 9 | Constancy dots — last 10 days as mini sun/cloud icons in MissionCenter | Component | 2h |

**Sprint 4 definition of done:** Full loop works: check-in → score update → missions adapt → complete mission → earn points → constancy updates. All persisted locally.

---

## Scoring rules (product invariants)

```text
Points awarded for:
  check-in completed        12 pts
  microcheck completed       3 pts  (max 2/day = 6 pts)
  simple mission             5 pts
  medium mission             8 pts
  support-others mission     6 pts
  daily constancy bonus      5 pts

Points NEVER awarded for:
  emotional state (happy/sad/anxious)
  incident reports
  high/low scores
```

> These values are initial. Flag as `// DEBT: calibrate point values with engagement data`.

## Mission categories

| Category | Examples |
| ---------- | ---------- |
| Breathing | 1-min guided breathing, box breathing |
| Hydration | Drink 1/2/3 glasses of water |
| Pause | Stand up for 2 min, screen break |
| Stretch | Quick desk stretch |
| Light focus | 5-min focus block |
| Connection | Send a support message |
| Gratitude | Note one good thing today |
| Boundary | Set one limit today |
| Closure | Close your day in 20 seconds |

---

## API dependencies

| Endpoint | Needed by | Contract |
| ---------- | ----------- | ---------- |
| `GET /api/scores/user/:id/today` | S3 | `{ recarga: number, estadoDoDia: number, segurancaRelacional: number, skyState: string }` |
| `GET /api/missions/user/:id/today` | S4 | `Mission[]` |
| `POST /api/missions/:id/complete` | S4 | `{ pointsAwarded: number }` |
| `GET /api/points/user/:id` | S4 | `{ total: number, today: number, streak: number }` |

---

## Risks

| Risk | Impact | Mitigation |
| ------ | -------- | ------------ |
| Mission engine produces repetitive missions | User boredom, drop-off | Pool of 30+ missions across categories; weighted random with recency bias |
| Points feel meaningless without consequence | No motivation to earn | Constancy dots + Solar Halo brightness create visual feedback loop |
| Dashboard redesign breaks existing functionality | Regressions | Keep old dashboard accessible at `/dashboard-legacy` during S3 |

---

## Files touched

| File | Action |
| ------ | -------- |
| `client/src/pages/dashboard.tsx` | Rewrite — new layout with SkyHeader + ScoreCards |
| `client/src/pages/missions.tsx` | Create — mission center |
| `client/src/lib/mission-engine.ts` | Create — adaptive mission selection |
| `client/src/components/mission-card.tsx` | Create |
| `client/src/components/solar-points-badge.tsx` | Create |
| `client/src/App.tsx` | Edit — add `/missions` route |
