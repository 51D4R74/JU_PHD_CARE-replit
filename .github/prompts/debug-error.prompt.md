---
name: debug-error
description: Guided diagnosis of a specific error using the app's known debug paths.
argument-hint: [error message, status code, or symptom]
agent: agent
---
# Debug Error

Error: ${input:error:Paste the error message, status code, or symptom}

Instructions:

- Apply these rules:
  - [Global instructions](../copilot-instructions.md)
  - [Debugging rules](../instructions/debugging.instructions.md)
  - [Security rules](../instructions/security.instructions.md)
- Match to a known debug path (server start, API route, client auth, build failure, database).
- Read the actual failing code before making claims.
- Trace through: route handler → validation → storage → response.
- Propose the minimal fix with rationale.

Output:

1. **Classification**: Error category (validation, auth, storage, build, runtime)
2. **Root cause**: One sentence
3. **Evidence**: File and line where the error originates
4. **Fix**: Code change with explanation
5. **Validation**: Command to verify the fix
