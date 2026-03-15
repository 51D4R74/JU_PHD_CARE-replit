---
description: "Use when working on server routes, storage layer, shared schema, client pages, or refactoring structural code."
name: "Architecture"
applyTo: "server/**,shared/**,client/src/pages/**,client/src/lib/**,client/src/hooks/**,script/**"
---
# Architecture

## Stack

| Layer | Technology |
|---|---|
| Client | React 18 + Vite + wouter + TanStack Query |
| UI | shadcn/ui (Radix + Tailwind CSS) |
| Server | Express 5 + tsx (dev) + esbuild (prod) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod via drizzle-zod |
| Auth | Custom (localStorage + username/password) |

## Layer responsibilities

### `shared/schema.ts`

Single source of truth for all entities. Drizzle table definitions, Zod insert schemas, TypeScript types.

New entity checklist: table → insert schema → export types.

### `server/storage.ts`

Persistence abstraction. `IStorage` interface defines all data operations.
`MemStorage` is the current implementation with seed data for dev.
When migrating to PostgreSQL: implement `DrizzleStorage` against the same interface.

### `server/routes.ts`

Express route handlers. All routes registered in `registerRoutes()`.
Keep handlers thin — validate with Zod, delegate to storage.

```typescript
// ✅ Correct — Zod validation, storage delegation, PT-BR error
app.post("/api/checkins", async (req, res) => {
  try {
    const data = insertCheckInSchema.parse(req.body);
    const checkIn = await storage.createCheckIn(data);
    return res.json(checkIn);
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
});

// ❌ Wrong — no validation, raw body to storage
app.post("/api/checkins", async (req, res) => {
  const checkIn = await storage.createCheckIn(req.body);
  return res.json(checkIn);
});
```

### `client/src/pages/`

Page components. Each page is a route in `App.tsx` via wouter.
Protected routes use `<ProtectedRoute>` wrapper with optional `requireRole`.

### `client/src/lib/`

Client utilities. `auth.ts` (auth state), `queryClient.ts` (TanStack Query config), `utils.ts` (Tailwind merge).

## API conventions

- Base path: `/api/`
- Auth routes: `/api/auth/login`, `/api/auth/register`
- Entity routes: `/api/{entity}`, `/api/{entity}/{id}`, `/api/{entity}/user/{userId}`
- Error response: `{ message: string }` with appropriate HTTP status
- Success response: entity JSON directly
- Validation errors: 400 with Zod error message

## Adding a new entity

1. Define table in `shared/schema.ts`
2. Create insert schema with `createInsertSchema` and export types
3. Add methods to `IStorage` interface
4. Implement in `MemStorage`
5. Add routes in `server/routes.ts` with Zod validation
6. Run `npm run db:push` to sync PostgreSQL schema

## Rules

- All entities defined in `shared/schema.ts` — no ad hoc types in route files.
- Storage operations go through `IStorage` interface — no direct DB access in routes.
- Validate input with Zod schemas before any storage operation.
- API error messages in PT-BR for user-facing responses.
- Keep route handlers thin — complex logic goes in storage methods or service functions.

## Anti-patterns

- Types defined in route files instead of `shared/schema.ts`
- Skipping Zod validation and passing `req.body` directly to storage
- Business logic inline in route handler instead of storage or service layer
- Duplicate type definitions that shadow schema types
- Direct database calls bypassing the `IStorage` interface
