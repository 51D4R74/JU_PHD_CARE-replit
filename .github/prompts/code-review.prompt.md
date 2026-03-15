---
name: code-review
description: Review code, diffs, or a PR for correctness, security, and architecture compliance.
argument-hint: [PR, diff, file, or area to review]
agent: agent
---
# Code Review

Review target: ${input:target:Describe the PR, diff, file, or area to review}

Instructions:

- Apply these rules:
  - [Global instructions](../copilot-instructions.md)
  - [Code review rules](../instructions/code-review.instructions.md)
  - [Architecture rules](../instructions/architecture.instructions.md)
  - [Security rules](../instructions/security.instructions.md)
- Read the real changed code; do not speculate.
- Prioritize: correctness, auth/validation gaps, schema drift, layer violations.
- Prefer a short list of high-confidence findings over weak commentary.

Output format:

1. Findings (severity, location, impact, fix)
2. Open questions or assumptions
3. Residual risk or testing gaps
