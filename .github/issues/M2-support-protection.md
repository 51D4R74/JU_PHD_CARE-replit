# M2 — Support & Protection

**Epic:** Support layer — curated messages, Modo Respiro, microchecks
**Sprints:** S5–S6 (4 weeks)
**Priority:** 🟡 High — differentiator; safety net for vulnerable users
**Labels:** `milestone:m2` `priority:high` `type:feature`
**Depends on:** M1 complete (missions + scores exist)

---

## Goal

When a user is struggling, the app responds with support — not silence. Curated messages, Modo Respiro mode, microcheck follow-ups, and a redesigned protection page. The app earns trust in its hardest moment.

---

## Success criteria

- [ ] User can request a support message by category (calm, courage, warmth, lightness)
- [ ] Curated library contains ≥ 40 messages across 4 categories
- [ ] `Modo Respiro` activates when state is critical: SkyHeader changes, missions simplify, social features deprioritize
- [ ] Microcheck appears after completing a mission or after OneTapMood signals distress
- [ ] Microcheck is dismissible in 1 tap, never more than 2/day
- [ ] User can submit a new text support message (stored for future moderation)
- [ ] Protection page (`protecao.tsx`) redesigned to match new visual system
- [ ] "Preciso de apoio" from OneTapMood routes directly to SupportCenter

---

## Sprint 5 — Support center + curated library + Modo Respiro

| # | Task | Type | Est |
| --- | ------ | ------ | ----- |
| 1 | `SupportCenter` page — tabs: receive message / leave message / protected route | Page | 6h |
| 2 | Curated message library — JSON data file, ~40 messages tagged by category (calma, coragem, acolhimento, leveza) | Data | 3h |
| 3 | `SupportMessageCard` component — displays message, category badge, favorite toggle | Component | 2h |
| 4 | Message selection engine — picks message based on current state, category, and history (avoid repeats) | Lib | 3h |
| 5 | Modo Respiro integration — when `skyState === "respiro"`: SkyHeader animates quieter, missions reduce, support CTAs gain prominence | Behavior | 4h |

**Sprint 5 definition of done:** User can open SupportCenter, choose a category, receive a curated message, and favorite it. Modo Respiro changes the UI when activated.

## Sprint 6 — Microchecks, message authoring, protection redesign

| # | Task | Type | Est |
| --- | ------ | ------ | ----- |
| 6 | Microcheck trigger flow — appears after mission completion or after OneTapMood distress signal | Interaction | 4h |
| 7 | Microcheck component refinement — conditional follow-up question ("O que pesa mais agora?") | Component | 2h |
| 8 | "Leave a support message" form — text input (max 280 chars), preview, submit | Component | 3h |
| 9 | Refactor `protecao.tsx` — retain all existing incident reporting functionality, apply new design system visual tokens | Page | 4h |
| 10 | Route `/support` added, nav icon updated, "Preciso de apoio" from OneTapMood wired to SupportCenter | Routing | 2h |

**Sprint 6 definition of done:** Microchecks trigger contextually. User can author a support message. Protection page has new visual language but identical functionality.

---

## Curated message library structure

```json
{
  "id": "calm-001",
  "category": "calma",
  "text": "Hoje não precisa dar conta de tudo.",
  "tags": ["overload", "general"]
}
```

Categories: `calma` (calm), `coragem` (courage), `acolhimento` (warmth), `leveza` (lightness).

> User-authored messages are stored but NOT served until moderation pipeline exists. Flag as `// DEBT: moderation pipeline needed before enabling community messages`.

---

## Modo Respiro behavior spec

| Layer | Normal | Modo Respiro |
| ------- | -------- | -------------- |
| SkyHeader | Animated per state | Quieter animation, slower transitions |
| Missions | 3–4 adapted | 2 max, basic care only (water, breathe, rest) |
| Notifications | Up to 3/day | 1 max, support-only |
| Social features | Visible | Deprioritized (not hidden) |
| Support CTA | Standard | Prominent, top of screen |
| Point earning | Normal | Normal (constancy still counts) |

**Entry:** Automatic when score drops below threshold OR user selects "Preciso de apoio" twice in 24h.
**Exit:** User manually deactivates OR scores improve for 2 consecutive days.

---

## API dependencies

| Endpoint | Needed by | Contract |
| ---------- | ----------- | ---------- |
| `GET /api/support-messages?category=` | S5 | `SupportMessage[]` |
| `POST /api/support-messages` | S6 | `{ text: string }` → `{ id, status: "pending_review" }` |
| `POST /api/microchecks` | S6 | `{ mood: string, context?: string, timestamp: string }` |

---

## Risks

| Risk | Impact | Mitigation |
| ------ | -------- | ------------ |
| Curated library feels generic | Users don't engage with support messages | Write messages with clinical/editorial input; A/B test phrasing |
| Modo Respiro is a UX dead end | User gets stuck in quiet mode with nothing to do | Ensure at least 2 micro-missions always available; show gentle "feeling better?" prompt after 24h |
| Unmoderated user messages | Toxic/inappropriate content | User messages stored as `pending_review`, never served without moderation. Library-only in MVP |

---

## Files touched

| File | Action |
| ------ | -------- |
| `client/src/pages/support.tsx` | Create — support center |
| `client/src/lib/support-messages.json` | Create — curated message library |
| `client/src/lib/support-engine.ts` | Create — message selection logic |
| `client/src/components/support-message-card.tsx` | Create |
| `client/src/pages/protecao.tsx` | Edit — visual redesign, preserve functionality |
| `client/src/components/one-tap-mood.tsx` | Edit — wire "Preciso de apoio" to support route |
| `client/src/components/sky-header.tsx` | Edit — Modo Respiro animation variant |
| `client/src/App.tsx` | Edit — add `/support` route |
