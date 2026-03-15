---
description: "Use when reviewing code, pull requests, patches or diffs."
name: "Code Review"
applyTo: "client/src/**,server/**,shared/**"
---
# Code Review

## Priority order

1. **Correctness**: wrong logic, behavioral regression, crash
2. **Security**: plaintext passwords, missing auth check, unvalidated input
3. **Contract**: schema drift, wrong type at boundary, inconsistent API response
4. **Architecture**: code in wrong layer, duplicated types, storage interface bypass
5. **Tests**: missing coverage on critical path (when test infrastructure exists)

## Checklist

- [ ] Input validated with Zod schema before storage operation
- [ ] Auth check present on protected routes
- [ ] Error response uses `{ message: string }` format in PT-BR
- [ ] Types imported from `shared/schema.ts`, not ad hoc
- [ ] Storage operations go through `IStorage` interface
- [ ] Route handler is thin — logic delegated to storage/service

## Finding format

```
**[SEVERITY] Issue title**
Where: `path/to/file.ts:L42`
What: description of the problem
Why: impact or risk
Fix: concrete suggestion (if not obvious)
```

Severities: `CRITICAL` → `HIGH` → `MEDIUM` → `LOW` → `NITPICK`

## Rules

- Findings first. Summary after findings or omit.
- Prefer few high-confidence findings over a long list of suspicions.
- If something is an assumption, label it as such.
- If no findings exist, say so explicitly and mention test gaps or remaining verification.
- Don't pad review with praise or generic commentary.

## Anti-patterns

- Review that ignores auth and input validation
- Praise as padding for weak findings
- Finding without location, impact, or suggested fix
- Approving "locally clean" code that violates layer boundaries
