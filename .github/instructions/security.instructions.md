---
description: "Use when working on authentication, authorization, input validation, or any security-sensitive path."
name: "Security"
applyTo: "server/**,client/src/lib/auth.ts,shared/schema.ts"
---
# Security

## Current auth model

- Login: `POST /api/auth/login` compares with `bcrypt.compare`. Passwords hashed on registration.
- Session: `express-session` with httpOnly, sameSite=lax cookies. `SESSION_SECRET` env var in production.
- Session validation: `GET /api/auth/me` — client validates on mount via `validateSession()`.
- Logout: `POST /api/auth/logout` destroys server session + clears client localStorage.
- Roles: `collaborator`, `rh`. Enforced server-side via `requireRole()` middleware.
- All user-specific routes protected by `requireAuth` + `requireOwner` (or `requireRole("rh")` for admin routes).
- Rate limiting: `express-rate-limit` on auth endpoints (20 attempts / 15 min window).

## Known vulnerabilities (tracked debt)

| Issue | Severity | Location |
|---|---|---|
| ~~Plaintext password storage/comparison~~ | ~~CRITICAL~~ | Resolved — bcrypt hashing in `storage.ts` + `routes.ts` |
| ~~No server-side auth on API routes~~ | ~~CRITICAL~~ | Resolved S19 — `requireAuth` + `requireOwner` middleware in `server/middleware.ts` |
| ~~No rate limiting on login~~ | ~~HIGH~~ | Resolved S19 — `express-rate-limit` on `/api/auth/*` |
| ~~Client-side only access control~~ | ~~HIGH~~ | Resolved S19 — server session + middleware; client `ProtectedRoute` is UX layer only |
| No CSRF protection | MEDIUM | SameSite=lax cookie + JSON-only API mitigates; explicit token deferred |
| Hardcoded passwords in seed data | LOW | `server/storage.ts` |

## Input validation

- Validate EVERY API route input before processing.
- Use Zod schemas from `shared/schema.ts` — they already exist for inserts.
- Reject malformed input with 400 and descriptive PT-BR message.

```typescript
// ✅ Correct — Zod validation at route boundary
const data = insertCheckInSchema.parse(req.body);

// ❌ Wrong — blind trust
const checkIn = await storage.createCheckIn(req.body);
```

## Guidelines for new code

- Never store or compare plaintext passwords. Use bcrypt or argon2.
- Add server-side auth check on any route that reads/writes user-specific data.
- Validate all input at the route boundary with Zod.
- Don't expose internal error details (stack traces, SQL) in API responses.
- Don't log passwords, tokens, or PII.
- Secrets in environment variables (`DATABASE_URL`, etc.), never in committed code.

## Rules

- Every route accessing user data should verify the caller's identity server-side.
- Input validation is mandatory at every API boundary.
- Error responses: PT-BR message without internal details.
- Check `.gitignore` before creating files with credentials.

## Anti-patterns

- Storing or comparing plaintext passwords in new code
- API route without input validation
- Client-side auth as the only access control layer
- Logging passwords, tokens, or sensitive user data
- Trusting `req.body` fields for authorization without server verification
- Secrets or credentials committed to the repository
