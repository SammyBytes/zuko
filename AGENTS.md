# Zuko monorepo – agent guide

## Runtime

- **Bun workspace monorepo** — never use npm/yarn/pnpm. `bun install` at root.
- No build step. `tsconfig.json` has `noEmit: true`. Bun runs `.ts` directly.
- Entrypoint: `bun packages/zuko/src/index.ts`. Also registered as `zuko` CLI bin.
- Root `tsconfig.json` covers all packages (no per-package tsconfigs).
- `.gitignore` includes `.zuko/*` — workflow files under `.zuko/workflows/` are local-only.

## Packages

| Dir | npm name | Role |
|---|---|---|
| `packages/zuko` | `@sammybits/zuko-cli` | CLI app (commander + @clack/prompts TUI) |
| `packages/plugin-groq` | `@sammybits/zuko-plugin-groq` | Groq LLM plugin via `@ai-sdk/openai` |
| `packages/core` | `@sammybits/zuko-core` | Shared types: `AIPlugin`, `Workflow`, `WorkflowNode`, `ZukoCommand`, `CommandContext` |

## Architecture

```
zuko/src/
  commands/        ← Command definitions + Commander wiring (pure logic, no TUI)
    index.ts       ← Manifest — imports all commands, provides registerCommands()
    run.command.ts
    create.command.ts
    list.command.ts
  tui/             ← Interactive wrappers using @clack/prompts
    index.ts       ← Main interactive menu
    run.tui.ts     ← Prompts user, calls runPipeline() from command
    create.tui.ts  ← Wizard, calls createWorkflow() from command
    shared.ts      ← Clipboard + output helpers
  registry.ts      ← Dynamic plugin discovery (scans node_modules/@sammybits/zuko-plugin-*)
  storage.ts       ← Workflow I/O (reads/writes .zuko/workflows/*.json)
  index.ts         ← Entrypoint: loadPlugins → registerCommands → parse or TUI
```

## Key quirks

### Command system

Commands auto-register via `commands/index.ts` manifest. To add a new command:
1. Create `commands/mycommand.command.ts` exporting a `ZukoCommand` with `name`, `description`, `setup()`
2. Import and add it to the `commands` array in `commands/index.ts`

Each command has a pure logic function (no TUI deps) exposed separately so the TUI layer can call it.

### Dynamic plugin discovery

`registry.ts` scans `node_modules/@sammybits/` for packages matching `zuko-plugin-*` and dynamically `import()`s them. Adding a new AI provider means:
1. `bun add @sammybits/zuko-plugin-whatever`
2. That's it — no code changes, no config

Plugins export a default `AIPlugin` object with `{ id, name, description, execute() }`.

### Plugin interface

```typescript
interface AIPlugin {
  id: string;        // e.g. "groq", "gemini"
  name: string;
  description?: string;
  execute(prompt: string, systemInstruction?: string, modelId?: string): Promise<string>;
}
```

No hardcoded model lists. The user decides which model string to use.

### No logger

No pino or any logging framework. CLI mode uses `console.log`/`console.error`. TUI mode uses `@clack/prompts` (`p.log.*`). Debug: set `ZUKO_DEBUG=1` for extra output.

## Env

- `GROQ_API_KEY` — required for Groq plugin
- `LOG_LEVEL` — unused (legacy)

## Development loop

1. `bun install` at root
2. `bun link --cwd packages/plugin-groq && bun link @zuko/plugin-groq --cwd packages/zuko` (see README for linking rationale)
3. `bun packages/zuko/src/index.ts` to run

## Tests / CI

None. No test frameworks, lint configs, formatters, or CI workflows are set up.

## Workflow files

Serialized as JSON to `.zuko/workflows/<id>.json`. Created via `create` command (TUI wizard or CLI flags). Model IDs are free strings — the user writes whatever the provider accepts.
