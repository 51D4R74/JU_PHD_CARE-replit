# M3 — History & Discoveries

**Epic:** Personal evolution — history, tags, correlations, reports
**Sprints:** S7–S8 (4 weeks)
**Priority:** 🟡 High — unlocks long-term retention and perceived value
**Labels:** `milestone:m3` `priority:high` `type:feature`
**Depends on:** M1 complete (scores + check-ins exist)

---

## Goal

The user sees their journey over time. Tags they've been marking reveal private patterns. The app shows correlations — not diagnoses — after enough data accumulates. Personal reports make the invisible visible.

---

## Success criteria

- [ ] `MeuCuidado` page renders score trends for last 7 and 30 days
- [ ] Tag system integrated into check-in flow (selectable context tags)
- [ ] User with ≥ 14 days of data sees at least 1 auto-generated discovery
- [ ] Discoveries phrased as correlations, never causal claims
- [ ] Weekly report page renders clean summary with scores, missions, constancy
- [ ] Monthly report available with trends and tag frequency
- [ ] Constancy indicator (last 10 days as sun/cloud dots) visible in MeuCuidado
- [ ] Favorite support messages accessible from MeuCuidado

---

## Sprint 7 — History page + tags + constancy

| # | Task | Type | Est |
| - | ---- | ---- | --- |
| 1 | `MeuCuidado` page — score trend chart (7d/30d toggle), tag cloud, constancy dots, favorites | Page | 8h |
| 2 | Tag system refinement — integrate existing `checkin-data.ts` tags into new check-in model, add UI for tag selection | Component | 3h |
| 3 | `InsightCard` component — "Nos dias com tag X, seu score Y tende a Z" + disclaimer | Component | 2h |
| 4 | Constancy visual — last 10 days as mini sun/cloud/respiro dots | Component | 2h |
| 5 | Route `/meu-cuidado` added to `App.tsx` | Routing | 1h |

**Sprint 7 definition of done:** MeuCuidado page shows real historical data. Tags visible in check-in history. Constancy dots render from persisted data.

## Sprint 8 — Discovery engine + reports

| # | Task | Type | Est |
| - | ---- | ---- | --- |
| 6 | `client/src/lib/discovery-engine.ts` — correlate tags with scores after ≥ 14 data points; output 1–3 discoveries | Lib | 6h |
| 7 | `PersonalReport` page — weekly summary (scores, missions, constancy, top tags, discoveries) | Page | 6h |
| 8 | Monthly report variant — same layout, 30-day window, trend arrows | Page | 2h |
| 9 | Report share placeholder — "share with trusted professional" button (disabled until backend supports it) | Component | 1h |

**Sprint 8 definition of done:** User with 14+ days of data sees discoveries on MeuCuidado. Weekly and monthly reports render from local data. Share button exists but shows "coming soon".

---

## Discovery engine rules

```text
Minimum data: 14 business days with check-in completed
Correlation method: simple frequency analysis (not statistical)
Output format: "Nos dias com tag '{tag}', seu {score} costuma {direction}"
Max discoveries shown: 3 at a time
Refresh: weekly (not real-time)

CRITICAL: Always display as observation, never causation.
  ✅ "Nos dias com 'reuniões demais', seu fechamento costuma piorar"
  ❌ "'Reuniões demais' causa piora no seu fechamento"
```

## Available tags

| Tag key | Display (PT-BR) |
| ------- | --------------- |
| `meetings` | Reuniões demais |
| `leadership` | Liderança |
| `difficult_client` | Cliente difícil |
| `family` | Família |
| `commute` | Trânsito |
| `therapy` | Terapia |
| `exercise` | Atividade física |
| `rushed_lunch` | Almoço corrido |
| `no_breaks` | Sem pausa |
| `good_sleep` | Boa noite de sono |
| `poor_sleep` | Noite mal dormida |

---

### API dependencies

| Endpoint | Needed by | Contract |
| -------- | --------- | -------- |
| `GET /api/checkins/user/:id/history?days=` | S7 | `CheckinHistory[]` with scores and tags |
| `GET /api/tags/user/:id/stats` | S7 | `{ tag: string, count: number, avgScore: Record<string, number> }[]` |
| `GET /api/discoveries/user/:id` | S8 | `Discovery[]` |
| `GET /api/reports/user/:id?period=week\|month` | S8 | `Report` |

---

### Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| 14-day wait for first discovery | Users lose interest before value appears | Show "X dias para sua primeira descoberta" progress indicator |
| False correlations | Misleading insights damage trust | Always show sample size; require minimum 5 occurrences of a tag; strong disclaimer copy |
| Chart library bundle size | Performance regression | Use lightweight charting (recharts already in deps — reuse) |

---

### Files touched

| File | Action |
| ---- | ------ |
| `client/src/pages/meu-cuidado.tsx` | Create — personal history |
| `client/src/pages/report.tsx` | Create — weekly/monthly reports |
| `client/src/lib/discovery-engine.ts` | Create — correlation analysis |
| `client/src/components/insight-card.tsx` | Create |
| `client/src/lib/checkin-data.ts` | Edit — ensure tags align with new model |
| `client/src/App.tsx` | Edit — add `/meu-cuidado`, `/report` routes |
