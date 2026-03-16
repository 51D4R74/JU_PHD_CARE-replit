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
- **Tables**: `community_messages` (id, userId, authorName, anonymous, content, audioUrl, mediaType, category, likeCount, createdAt) + `message_likes` (id, messageId, userId, createdAt)
- **API**: `GET /api/community-messages?page=0&limit=20`, `POST /api/community-messages` (content/audioUrl, mediaType, anonymous), `POST /api/community-messages/:id/like` (toggle), `POST /api/upload-audio` (multipart audio file)
- **Frontend**: `CommunityFeed` component with infinite pagination (`useInfiniteQuery`), audio player, rank badges (#1-3), like toggle with optimistic updates
- **Compose**: Escrever/Gravar toggle in "Deixar" tab — text textarea or hold-to-record MediaRecorder with upload
- **Location**: Feed is always visible below LuminaCard on support page; compose form is in "Deixar" tab
- **Audio uploads**: Saved to `uploads/` directory, served at `/uploads/<filename>`

## Wellness Readiness Panel (Oura-inspired)
- **Component**: `client/src/components/wellness-readiness-card.tsx` — 4 bar indicators (Energia, Foco, Equilíbrio, Conexão) derived from check-in domain scores
- Shown on Meu Cuidado page after check-in with adaptive phrase
- Color-coded bars: green (75+), gold (50+), orange (25+), red (<25)

## Mission Notification Scheduler
- **Hook**: `client/src/hooks/use-mission-notification-scheduler.ts` — schedules setTimeout at 08:30, 12:10, 17:00
- Picks category-relevant mission for each time slot (morning=movement/focus, lunch=connection/social, evening=closure/gratitude)
- Deduplicates via localStorage key `lumina_mission_notif_sent`; respects quiet hours from settings
- Integrated in dashboard.tsx on mount

## Notification Deep-Linking
- Mission-type notifications in NotificationDrawer navigate to `/missions` on click
- Uses wouter `navigate()` from the drawer component

## Chat Orchestrator (JuPHD Pro)
- **Lambda URL**: `https://tmh2e2ojppixtgl3fcs56um74y0ilkpx.lambda-url.us-east-1.on.aws/`
- **Env var**: `CHAT_ORCHESTRATOR_URL` (fallback to hardcoded URL if unset)
- **DB tables**: `chat_conversations` (id, userId, title, orchestratorSessionId, orchestratorConversationId, createdAt, updatedAt) + `chat_messages` (id, conversationId, role, content, createdAt)
- **Server API**:
  - `POST /api/chat` — validates message, proxies to orchestrator, persists user+bot messages to `chat_messages`, auto-creates/updates `chat_conversations`; returns `{ reply, session_id, conversation_id, db_conversation_id }`
  - `GET /api/chat/conversations` — lists user's past conversations with preview
  - `GET /api/chat/conversations/:id/messages` — returns full message list for a conversation
  - `POST /api/chat/close` — sends `closeSession: true` to orchestrator (best-effort)
- **Full-screen page**: `client/src/pages/chat-page.tsx` at `/chat` — no bottom nav, brand gradient background, bot avatar, typing indicator, conversation history panel, confidentiality note
- **Entry point**: JuPHD Chat Card on dashboard/missions/support/meu-cuidado redirects to `/chat?q=<message>` on submit
- **Old drawer**: `chatbot-drawer.tsx` retained but no longer imported anywhere — replaced by full page

## User Flows
1. **Login** → Dashboard (collaborator) or RH Dashboard (hr role)
2. **Dashboard** → Check-in wizard (5 steps) → Save → Back to dashboard
3. **Dashboard** → Protection page → Anonymous reporting or crisis intervention
4. **RH Dashboard** → Analytics view with charts, alerts, risk levels
