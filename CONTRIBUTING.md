# Contributing

This guide is for developers who want to build Zuko from source, add commands, or create new plugins.

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) 1.x
- Git

### Clone and install

```bash
git clone https://github.com/SammyBytes/zuko.git
cd zuko
bun install
```

### Development loop

```bash
# Run the CLI directly (no build step)
bun packages/zuko/src/index.ts

# Type-check across all packages
bun run typecheck
```

No build step — Bun runs `.ts` files directly.

---

## Project structure

```
zuko/
├── packages/
│   ├── core/                  Shared types (AIPlugin, Workflow, etc.)
│   ├── plugin-groq/           Groq LLM provider plugin
│   └── zuko/                  CLI app — commands, engine, TUI
├── tsconfig.json              Single root config (no per-package tsconfigs)
└── .github/workflows/ci.yml   CI/CD pipeline
```

### Inside `packages/zuko`

```
src/
  index.ts           Entrypoint — injects env vars from config, loads plugins, starts CLI or TUI
  registry.ts        Plugin discovery — scans node_modules/@sammybits/zuko-plugin-*
  config.ts          Config I/O — reads/writes ~/.config/zuko/config.json, env var injection, missing key detection
  storage.ts         Workflow I/O — reads/writes .zuko/workflows/*.json

  engine/
    dag.ts           Primary executor — DAG with parallel waves, linear fallback
    pipeline.ts      Legacy reference — linear-only, no longer used by commands

  commands/          One directory per command
    index.ts         Manifest — imports all commands, exposes registerCommands()
    run/             Run command — index.ts + tui.ts
    create/          Create command — index.ts + tui.ts + templates.ts
    edit/            Edit command — index.ts + tui.ts
    config/          Config command — index.ts + tui.ts

  tui/
    index.ts         Dynamically discovers TUI handlers from commands/*/tui.ts + missing key warning
    shared.ts        Clipboard + output helpers
```

---

## Adding a new command

Each command is a directory under `commands/` with two files:

```
commands/mycommand/
  index.ts     ← Pure logic + Commander setup (no TUI deps)
  tui.ts       ← Interactive wizard (default export, optional)
```

### 1. Create `commands/mycommand/index.ts`

```typescript
import type { ZukoCommand } from "../index.ts";

export const myCommand: ZukoCommand = {
  name: "mycommand",
  description: "What my command does",
  setup(program) {
    program
      .command("mycommand")
      .description("What my command does")
      .action(async () => {
        // CLI logic here
      });
  },
};
```

### 2. Create `commands/mycommand/tui.ts` (optional)

```typescript
import type { AIPlugin } from "@sammybits/zuko-core";

export default async function myCommandTui(plugins: Map<string, AIPlugin>) {
  // Interactive menu logic here
}
```

If no `tui.ts` exists, the command simply won't appear in the TUI menu.

### 3. Register in `commands/index.ts`

```typescript
import { myCommand } from "./mycommand/index.ts";

const commands: ZukoCommand[] = [runCommand, createCommand, editCommand, myCommand];
```

---

## Adding a new plugin (AI provider)

### Package naming

Plugins must follow the naming convention: `@sammybits/zuko-plugin-*` (any scope works, the registry scans `node_modules/@sammybits/`).

### Plugin interface

```typescript
import type { AIPlugin } from "@sammybits/zuko-core";

const plugin: AIPlugin = {
  id: "my-provider",          // Unique identifier
  name: "My Provider",        // Display name in TUI
  description: "Optional description",
  requiredEnvVars: {           // Optional: API keys the plugin needs
    "MY_API_KEY": "Description shown when prompting the user",
  },
  execute: async (prompt, systemInstruction, modelId) => {
    // The key is available via process.env.MY_API_KEY
    return "response text";
  },
};

export default plugin;
```

### `requiredEnvVars`

This optional field tells the config system what API keys your plugin
needs. Keys are stored in `~/.config/zuko/config.json` and injected
into `process.env` at startup.

- **Key**: the environment variable name (uppercase convention).
- **Value**: a human-readable description shown to the user when prompting for the key.

If `requiredEnvVars` is declared, Zuko will:
1. Prompt the user to set missing keys on first launch.
2. Show the key in the `config` TUI wizard.
3. Expose it via `zuko config set <ENV_VAR> --key <value>`.

### Registration is automatic

```bash
bun add @sammybits/zuko-plugin-my-provider
```

That's it. No config changes needed.

---

## Engine: DAG execution

`engine/dag.ts` is the primary executor.

- **DAG mode**: nodes with `dependsOn` form a dependency graph. Independent nodes run in parallel waves via `Promise.allSettled`.
- **Legacy mode**: if no node has `dependsOn`, the engine infers a linear chain.

Callbacks (`onWaveStart`, `onNodeStart`, `onNodeComplete`, `onNodeError`) let the TUI render a live tree during execution.

---

## Scripts

| `bun run ...` | What it does |
|---|---|
| `dev` | Run the CLI directly |
| `typecheck` | `tsc --noEmit` across all packages |
| `version:check` | Check local version against npm registry |
| `publish:all` | Publish all packages in workspace order |

Each package has a `prepublishOnly` script that runs `version:check` — you cannot publish a version that already exists on npm.

---

## CI/CD

`.github/workflows/ci.yml`:

- **PR to `dev`**: `bun install` + `typecheck`
- **Push to `main`**: `bun install` + `typecheck` + `publish:all` (core → plugin-groq → zuko)
- Requires `NPM_TOKEN` secret in the GitHub repository.

---

## Code conventions

- **No build step** — Bun runs `.ts` directly. `tsconfig.json` has `noEmit: true`.
- **No logger** — `console.log`/`console.error` in CLI mode, `@clack/prompts` (`p.log.*`) in TUI mode. Debug via `ZUKO_DEBUG=1`.
- **Pure logic in `index.ts`** — commands export pure functions with no TUI dependencies. The TUI layer lives in `tui.ts` and calls those functions.
- **No hardcoded model lists** — plugin IDs are free strings. The user writes whatever the provider accepts.
- **`workspace:^` protocol** — all inter-package dependencies use `"@sammybits/*": "workspace:^"` in `package.json`.
