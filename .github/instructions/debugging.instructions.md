---
description: "Use for debugging, failure analysis, runtime errors, and issue investigation."
name: "Debugging"
applyTo: "server/**,client/src/**,shared/**,script/**"
---
# Debugging

## Workflow

1. **Reproduce**: exact command, route, input, error message.
2. **Locate**: narrowest path — file, function, line.
3. **Read**: actual code and output before hypothesizing.
4. **Hypothesize**: max 3, evidence-based.
5. **Test**: one variable at a time.
6. **Fix**: root cause, not symptom.
7. **Verify**: original failure path + regression.

## Debug paths by symptom

### Server won't start

File: `server/index.ts`

1. Port 8000 already in use? Check `Get-NetTCPConnection -LocalPort 8000`.
2. Module resolution error? Check `tsconfig.json` paths and `vite.config.ts` aliases.
3. Dependency missing? Run `npm install`.
4. TypeScript syntax error? Run `npm run check`.

### API route returns unexpected result

File: `server/routes.ts`

1. Route path and HTTP method match the request?
2. Zod validation failing? Check schema in `shared/schema.ts` matches request body shape.
3. Storage method returning wrong data? Check `MemStorage` implementation and seed data in `server/storage.ts`.
4. Response format correct? Should be `{ message: string }` for errors.

### Client auth not working

File: `client/src/lib/auth.ts`

1. `localStorage` key `juphd_user` present and valid JSON?
2. `useSyncExternalStore` not triggering re-render? Check `setUser` calls listener set.
3. Login API response missing fields? Check `/api/auth/login` returns user without password.
4. `ProtectedRoute` redirecting? Check `isAuthenticated` and `requireRole` logic in `App.tsx`.

### React component not rendering / stale data

1. TanStack Query cache stale? Check `queryClient` config in `client/src/lib/queryClient.ts`.
2. Query key mismatch? Verify query keys match between fetch and invalidation.
3. Route not matching? Check wouter path in `App.tsx`.

### Build failure

File: `script/build.ts`

1. TypeScript errors? Run `npm run check`.
2. esbuild errors? Check server imports — only bundled deps work.
3. Vite build errors? Check client imports and `@` alias resolution.

### Database connection issues

File: `drizzle.config.ts`

1. `DATABASE_URL` environment variable set?
2. PostgreSQL running and accessible?
3. Schema pushed? Run `npm run db:push`.
4. Currently using `MemStorage` — DB issues only matter when using Drizzle implementation.

## Rules

- Never speculate without reading the relevant file.
- One variable at a time during isolation.
- Prefer evidence (log, stack, concrete input) over intuition.
- If not reproducible, say so clearly and collect minimal additional evidence.

## Anti-patterns

- Speculating without reading code
- Multiple simultaneous fixes during diagnosis
- Destructive action to get back to clean state
- Declaring resolved without re-running the original failure path
- Broad refactor during investigation
