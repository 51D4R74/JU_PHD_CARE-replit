---
name: api-route-scaffold
description: Scaffold a new Express API route with validation, storage interface, and types.
argument-hint: [entity or route purpose, e.g. "CRUD for wellness goals"]
agent: agent
---
# API Route Scaffold

Route purpose: ${input:purpose:Describe the entity or route purpose}

Instructions:

- Apply these rules:
  - [Global instructions](../copilot-instructions.md)
  - [Architecture rules](../instructions/architecture.instructions.md)
  - [Security rules](../instructions/security.instructions.md)
- Define entity table and types in `shared/schema.ts`.
- Create Zod insert schema with `createInsertSchema`.
- Add methods to `IStorage` interface in `server/storage.ts`.
- Implement in `MemStorage`.
- Add Express routes in `server/routes.ts` with Zod validation.
- Error responses in PT-BR using `{ message: string }` format.

Output:

1. Schema additions (`shared/schema.ts`)
2. Storage interface + `MemStorage` implementation changes
3. Route handlers with validation
4. Run `npm run check` to validate types
