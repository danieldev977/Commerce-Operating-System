---
name: API codegen runtime typing
description: Generated fetch clients rely on iterable DOM typings in the shared client package.
---

The generated API client uses `Headers.entries()`, so the client library TypeScript `lib` configuration must include both `dom` and `dom.iterable`.

**Why:** Orval generation succeeds before the shared library typecheck, so this appears as a post-codegen failure rather than a spec problem.

**How to apply:** When generated client code changes or a new artifact is added, keep `dom.iterable` enabled in the API client package before diagnosing generated output.