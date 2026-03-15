# M4 — Collective

**Epic:** Team challenges and aggregate progress
**Sprints:** S9–S10 (4 weeks)
**Priority:** 🟢 Medium — enhances engagement; not a blocker for individual use
**Labels:** `milestone:m4` `priority:medium` `type:feature`
**Depends on:** M1 complete (missions + points exist)

---

## Goal

Teams share a monthly collective mission. Progress is always aggregate — never individual. The collective sky brightens as the team progresses. RH dashboard shows real aggregate data instead of demo hardcoded values.

---

## Success criteria

- [ ] `TeamChallenge` page shows current monthly mission, aggregate progress, days remaining
- [ ] Individual contributions are private — only team total is visible
- [ ] Per-person daily cap prevents gaming (e.g., max 3 water contributions/day)
- [ ] Collective sky animation improves as team approaches goal
- [ ] Milestone animations trigger at 25%, 50%, 75%, 100%
- [ ] `rh-dashboard.tsx` rewritten with real aggregate data (or realistic stubs with correct data shape)
- [ ] No individual ranking, no "who didn't participate" visibility
- [ ] Team challenge is opt-in at the team level

---

## Sprint 9 — Team challenge UI + progress

| # | Task | Type | Est |
| - | ---- | ---- | --- |
| 1 | `TeamChallenge` page — current mission, progress arc, days left, milestone markers | Page | 6h |
| 2 | `TeamProgressArc` component — animated arc/ring showing aggregate progress toward goal | Component | 4h |
| 3 | Team challenge card on Home — compact progress indicator + "contribute" CTA | Component | 2h |
| 4 | Contribution flow — user taps "contribute" → selects eligible mission → recorded privately | Interaction | 3h |
| 5 | Route `/team` added to `App.tsx` | Routing | 1h |

**Sprint 9 definition of done:** Team challenge page renders. User can contribute. Progress updates. Individual contribution is not revealed.

## Sprint 10 — Collective sky + RH dashboard + celebrations

| # | Task | Type | Est |
| - | ---- | ---- | --- |
| 6 | Collective sky animation — team's SkyHeader variant that brightens with aggregate progress | Component | 4h |
| 7 | Milestone celebrations — animation + message at 25/50/75/100% thresholds | Interaction | 3h |
| 8 | Rewrite `rh-dashboard.tsx` — replace hardcoded demo data with aggregate data shape (real or structured stubs) | Page | 8h |
| 9 | RH aggregate cards — participation rate, average scores by department, alert summary | Component | 3h |

**Sprint 10 definition of done:** Collective sky reacts to team progress. Celebrations trigger at milestones. RH dashboard shows aggregate structure ready for backend integration.

---

## Team challenge examples

| Mission | Target | Unit | Cap/person/day |
| ------- | ------ | ---- | -------------- |
| Copos d'água coletivos | 200 | glasses | 3 |
| Pausas conscientes | 120 | pauses | 2 |
| Mensagens de apoio aprovadas | 80 | messages | 1 |
| Check-ins fechados | 150 | check-ins | 1 |
| Minutos de respiração | 60 | minutes | 3 |

## Safeguards (product invariants)

- Individual contribution is **private** — only aggregate total shown
- **No ranking** of individuals within a team
- **No ranking** of teams against each other (in collaborator view)
- **No visibility** into who has/hasn't participated
- Reward is **visual** (sky animation + collective message) — never tied to HR metrics
- RH sees only **aggregate participation rate**, not individual names

---

## API dependencies

| Endpoint | Needed by | Contract |
| -------- | --------- | -------- |
| `GET /api/team-challenges/:teamId/current` | S9 | `{ id, title, target, progress, endsAt, milestones }` |
| `POST /api/team-challenges/:id/contribute` | S9 | `{ type: string, amount: number }` → `{ accepted, newTotal }` |
| `GET /api/rh/aggregate` | S10 | `{ departments: DeptAggregate[], alerts: Alert[], participation: number }` |

---

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Gaming via repeated contributions | Inflated numbers, loss of trust | Daily per-person cap per mission type; server-side enforcement |
| Low participation makes progress stall | Team feels failure | Set achievable targets (80% of team contributing 1x/day should hit goal) |
| Managers use participation as performance signal | Surveillance disguised as wellness | RH aggregate shows only % participation, never names; document in onboarding |

---

## Files touched

| File | Action |
| ---- | ------ |
| `client/src/pages/team-challenge.tsx` | Create |
| `client/src/components/team-progress-arc.tsx` | Create |
| `client/src/pages/rh-dashboard.tsx` | Rewrite — real data structure |
| `client/src/components/rh-aggregate-card.tsx` | Create |
| `client/src/App.tsx` | Edit — add `/team` route |
