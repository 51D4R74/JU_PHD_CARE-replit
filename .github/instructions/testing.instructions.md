---
description: "Use when adding or editing tests."
name: "Testing"
applyTo: "**/*.{test,spec}.ts,**/*.{test,spec}.tsx,**/__tests__/**"
---
# Testing

## Status

No test runner is currently configured. When setting up:

- Recommended: **Vitest** (native Vite integration).
- Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom`
- Add script: `"test": "vitest run"` to `package.json`.

## Test structure

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature or module', () => {
  it('describes expected behavior clearly', () => {
    // Arrange → Act → Assert
  });
});
```

## What to test first

Priority based on current codebase risk:

1. **Storage interface** — `MemStorage` CRUD correctness (highest confidence gain).
2. **Route handlers** — input validation, error responses, edge cases.
3. **Schema validation** — Zod schemas reject malformed data.
4. **Auth logic** — `useAuth` state management, login/logout flow.

## Factory pattern

```typescript
// Correct: factory with defaults and overrides
function createCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: 'checkin-1',
    userId: 'user-1',
    humor: 'Bem',
    energy: 'Disposto',
    mind: 'Focado',
    sleep: 'Sono restaurador',
    contextTags: ['Trabalho'],
    notes: null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}
```

## Rules

- Test behavior and contracts, not implementation details.
- One behavior per test, descriptive name declaring expected outcome.
- Mock only external boundaries (database, HTTP), not internal modules.
- Bug fix = regression test.

## Anti-patterns

- Test that encodes a bug as expected result
- Broad snapshot replacing precise assertion
- Test without descriptive name
- Real database or network dependency in unit test
