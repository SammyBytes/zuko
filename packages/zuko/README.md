# @sammybits/zuko-cli

CLI app for running and creating prompt pipelines.

## Directory structure

```
src/
  index.ts           ← Entrypoint: loadPlugins → registerCommands → parse or TUI
  registry.ts        ← Dynamic plugin discovery (node_modules/@sammybits/zuko-plugin-*)
  storage.ts         ← Workflow I/O (.zuko/workflows/*.json)

  engine/
    dag.ts           ← Primary executor: DAG (parallel waves) with linear fallback
    pipeline.ts      ← Legacy reference (linear-only, unused by commands)

  commands/
    index.ts         ← Manifest: ZukoCommand interface, registerCommands(), getCommandMenuItems()
    run/
      index.ts       ← ZukoCommand for "run" (Commander setup, calls engine)
      tui.ts         ← Interactive run (DAG executor + tree renderer)
    create/
      index.ts       ← ZukoCommand for "create" + createWorkflow() pure function
      tui.ts         ← Interactive workflow creation wizard (templates + custom DAG builder)
    edit/
      index.ts       ← ZukoCommand for "edit" + updateWorkflow() pure function
      tui.ts         ← Interactive workflow editing wizard

  tui/
    index.ts         ← Dynamically discovers TUI handlers from commands/*/tui.ts
    shared.ts        ← Clipboard, output formatting
```

## Adding a new command

1. Create `commands/your-command/index.ts` exporting a `ZukoCommand`
2. Create `commands/your-command/tui.ts` (optional) with a default export handler
3. Import + add it to the `commands` array in `commands/index.ts`

The TUI menu discovers handlers automatically — if no `tui.ts` exists, the command won't appear in the menu.

## Adding a new AI provider

Install the plugin package:

```bash
bun add @sammybits/zuko-plugin-groq
```

That's it. The registry discovers it automatically.

## Engine

`engine/dag.ts` is the primary executor. It supports two modes:

- **DAG mode** — nodes with `dependsOn` form a dependency graph. Independent nodes run in parallel waves via `Promise.allSettled`.
- **Legacy linear mode** — if no node has `dependsOn`, it infers a sequential chain (backward compatible).

Callbacks (`onWaveStart`, `onNodeStart`, `onNodeComplete`, `onNodeError`) let the TUI render a live tree.

`engine/pipeline.ts` is kept as a reference linear executor but is no longer used by commands.

## Workflow format

Workflows are JSON files in `.zuko/workflows/<id>.json`. Each node has a `pluginId`, `systemInstruction`, optional `modelId`, `fallbackPluginId`, and `dependsOn` (array of upstream node IDs). Empty array = root node. `dependsOn` is what enables DAG topologies — set it in the create/edit wizards.
