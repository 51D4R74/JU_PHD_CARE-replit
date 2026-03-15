# JuPhD Care — Gestão de Riscos Psicossociais

## Overview
Corporate mental health platform focused on employee well-being (prevention and harassment protection) and data intelligence for HR (NR1 compliance and cost reduction). The visual metaphor is "Finding the sun after the rain" — dark night sky colors transitioning to warm golden/amber accents.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter (routing), Framer Motion (animations), Recharts (charts), Tailwind CSS, shadcn/ui, Phosphor Icons
- **Backend**: Express.js + TypeScript
- **Storage**: In-memory storage with seed data (MVP)
- **Build**: Vite

## Project Structure
- `client/src/pages/login.tsx` — Login page with password validation, forgot password flow
- `client/src/pages/dashboard.tsx` — Collaborator home with mentor, check-in CTA, knowledge pills
- `client/src/pages/checkin.tsx` — 5-step wizard (humor, energy, mind, sleep, context) with Framer Motion transitions
- `client/src/pages/protecao.tsx` — Emergency/protection page with anonymous reporting and crisis intervention
- `client/src/pages/rh-dashboard.tsx` — HR analytics dashboard with heatmaps, burnout prediction, harassment detection alerts
- `client/src/lib/auth.ts` — Client-side auth state management using useSyncExternalStore
- `server/routes.ts` — API endpoints for auth, check-ins, and incident reports
- `server/storage.ts` — In-memory storage with seeded demo data
- `shared/schema.ts` — Data models (users, checkIns, incidentReports) with Drizzle + Zod schemas

## Theme
- Dark mode by default (night sky aesthetic: deep blues, slate-900/950)
- Primary accent: Amber/Gold (hsl 38, 92%, 50%)
- Radial gradient "sunrise" effect on backgrounds
- Glass-card styling with backdrop blur

## Demo Credentials
- Collaborator: `maria@juphd.com` / `Senha@123`
- HR Manager: `rh@juphd.com` / `Senha@123`

## Storage
- Uses PostgreSQL (Drizzle ORM) when DATABASE_URL is set, falls back to in-memory storage
- Demo users are auto-seeded on first startup when using PostgreSQL
- Run `npm run db:push` to apply schema changes

## Icon System
- **Library**: `@phosphor-icons/react` (Phosphor Icons) — Noun Project style
- **shadcn/ui** components retain their own `lucide-react` imports (unchanged)
- **Weight conventions**: `fill` for active/emphasis, `bold` for carets/chevrons, `regular` for default
- **Type**: Use `Icon as PhosphorIcon` from `@phosphor-icons/react` for icon prop types

## Navigation
- **Shared BottomNav**: `client/src/components/bottom-nav.tsx` — 5 items: Início, Pra Você, Riscos (burst icon), Apoio, Sua Jornada
- Dashboard uses `variant="dark"` (glass-nav-dark); all other pages use default light variant
- Sub-route mapping: `/report` → Sua Jornada active, `/team-challenge` → Pra Você active, `/checkin` → Início active

## Community Messages
- **Tables**: `community_messages` (id, userId, authorName, anonymous, body, category, likeCount, createdAt) + `message_likes` (id, messageId, userId, createdAt)
- **API**: `GET /api/community-messages?limit=20&offset=0`, `POST /api/community-messages` (body, anonymous, category?), `POST /api/community-messages/:id/like` (toggle)
- **Frontend**: `CommunityFeed` component renders message cards with like buttons, ranking (top message), sort by recent/popular
- **Location**: Wired into the "Deixar" tab of the Apoio (Support) page with anonymous toggle

## User Flows
1. **Login** → Dashboard (collaborator) or RH Dashboard (hr role)
2. **Dashboard** → Check-in wizard (5 steps) → Save → Back to dashboard
3. **Dashboard** → Protection page → Anonymous reporting or crisis intervention
4. **RH Dashboard** → Analytics view with charts, alerts, risk levels
