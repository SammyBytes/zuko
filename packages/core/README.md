# @sammybits/zuko-core

Shared contracts for the Zuko ecosystem. This package has zero runtime logic — only TypeScript interfaces.

## When to add something here

If two or more packages need the same type, put it here. Currently:

| Interface | Used by |
|---|---|
| `AIPlugin` | plugins (e.g. `plugin-groq`) + `zuko` CLI |
| `Workflow`, `WorkflowNode` | `zuko` CLI (storage, engine) |
| `CommandContext` | `zuko` CLI (command registration) |
| `ZukoCommand` | `zuko` CLI (command definitions) |

## When NOT to add something here

- Runtime logic, configuration, or utilities that only one package uses — keep them there.
- Pipeline execution (DAG, node iteration) — that belongs in `zuko/src/engine/`.

## Creating a plugin

```typescript
import type { AIPlugin } from "@sammybits/zuko-core";

const plugin: AIPlugin = {
  id: "my-provider",
  name: "My Provider",
  execute: async (prompt, systemInstruction, modelId) => {
    // call your API
  },
};

export default plugin;
```

Package name convention: `@sammybits/zuko-plugin-*` (or any scope, the registry scans `node_modules/@sammybits/`).
