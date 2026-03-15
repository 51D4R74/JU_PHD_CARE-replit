# JUPHD Care — Global Instructions

## Scope

- Stack: Vite + React 18 + Express 5 + Drizzle ORM + PostgreSQL.
- Runtime: Node 22, NPM, dev server port 8000.
- Structure: `client/` (React SPA), `server/` (Express API), `shared/` (schema + types).
- Phase: Early development — build features on solid foundation, don't over-engineer.

## Language convention

- Instruction files, code comments, commit messages: **English**.
- User-facing output (UI text, API error messages): **Portuguese (PT-BR)**.

## Agent behavior

- Candor without flattery. Fix root cause, don't mask symptoms.
- Concise by default; expand only when clarity genuinely improves.
- Maximum autonomy; ask only on real blockers, business ambiguity, or destructive risk.
- Never speculate about unread code. Read the file before making claims.
- Don't invent facts. Don't create files without need. Don't use destructive actions as shortcuts.
- Ask confirmation before destructive, irreversible, or externally visible actions.

## Project structure

| Path | Purpose |
|---|---|
| `client/src/pages/` | Route pages (wouter) |
| `client/src/components/ui/` | shadcn/ui primitives (Radix + Tailwind) |
| `client/src/lib/` | Client utilities (auth, queryClient, utils) |
| `client/src/hooks/` | Custom React hooks |
| `server/routes.ts` | Express API route handlers |
| `server/storage.ts` | Storage interface (`IStorage`) + in-memory implementation |
| `shared/schema.ts` | Drizzle tables + Zod insert schemas + TS types |
| `script/build.ts` | Build pipeline (esbuild server + Vite client) |

## Key conventions

- Single source of truth for entities: `shared/schema.ts`.
- Storage abstraction: `IStorage` interface → `MemStorage` (current), PostgreSQL via Drizzle (next).
- Client auth: `useSyncExternalStore` + `localStorage` in `client/src/lib/auth.ts`.
- Roles: `collaborator`, `rh`. No multi-tenancy.
- API error format: `{ message: string }` with appropriate HTTP status.
- Validation: Zod schemas from `drizzle-zod` at route boundaries.

## Code quality rules (SonarLint compliance)

These rules prevent lint debt from accumulating. Apply them on every new file and every edit.

### TypeScript / React

- **Readonly props**: always mark component prop interfaces with `readonly` on each property AND wrap the destructured parameter: `{ x }: Readonly<MyProps>`.
- **No negated conditions**: write `x ? A : B`, not `!x ? B : A`. Positive branch first.
- **No nested ternaries**: extract to a named helper function or use `if/else`.
- **No nested template literals**: avoid `\`text ${condition ? \`inner ${val}\` : ""}\``. Flip to a plain ternary or string concatenation.
- **No bitwise truncation**: use `Math.trunc(n)` instead of `n | 0` or `n |= 0`.
- **Unicode-safe strings**: use `str.codePointAt(i) ?? 0` instead of `str.charCodeAt(i)`.
- **Non-mutating sort**: use `[...arr].toSorted(fn)` instead of `arr.sort(fn)`.
- **Array tail**: use `arr.at(-1)` instead of `arr[arr.length - 1]`.
- **Existence check**: use `.some(fn)` instead of `.filter(fn).length > 0`.
- **Re-exports**: use `export { X } from "module"` directly; avoid import + re-export two-liner.
- **No unused imports/assignments**: remove anything not referenced.
- **Cognitive complexity**: keep functions ≤ 15. Extract helpers when the limit is approached.

### Accessibility (a11y)

- Interactive list items must be `<button type="button">`, not `<li onClick>`.

### Spell check (cspell)

- New product-specific identifiers, abbreviations, PT-BR unaccented keys, or domain terms must be added to `cspell.json` `"words"` array immediately — never leave a term that will fail `npx cspell`.
- Do NOT rename working identifiers to satisfy cspell. Add the word instead.

### Markdown (`.md` files)

- First line must be `# Heading` (h1). Never start with `##`.
- Subheadings: one level below parent only (`#` → `##` → `###`).
- Table separators: `| --- |` format (spaces around dashes). Never `|---|`.
- Fenced code blocks must declare a language: ` ```ts `, ` ```bash `, ` ```text `, etc.

## Available scripts

```bash
npm run dev         # Start dev server (tsx + Vite HMR), port 8000
npm run build       # Production build (esbuild + Vite)
npm run start       # Run production build
npm run check       # TypeScript type check (tsc --noEmit)
npm run db:push     # Push Drizzle schema to PostgreSQL
```

## Tech debt policy

- Shortcuts tracked with `// DEBT: [reason] [ticket or deadline]`.
- Untracked debt is hidden debt — hidden debt is regression.

## Tool priority

1. Context already in conversation → 2. Local search → 3. File read → 4. Direct edit → 5. Terminal.
- Don't retry a failed tool. Degrade to cheaper alternative.
- Parallelize independent reads. Sequence dependent ones.

## Instruction topology

- **This file**: global invariants (always loaded — keep lean).
- **`.github/instructions/*.instructions.md`**: conditional rules by path or task.
- **`.github/prompts/*.prompt.md`**: reusable on-demand workflows.
- A rule for a single path or task MUST NOT inflate this file.
