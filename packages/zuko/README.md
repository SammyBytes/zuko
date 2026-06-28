# @sammybits/zuko-cli

CLI app for running and creating prompt pipelines.

## Directory structure

```
src/
  index.ts           ← Entrypoint: loadPlugins → registerCommands → parse or TUI
  registry.ts        ← Dynamic plugin discovery (node_modules/@sammybits/zuko-plugin-*)
  storage.ts         ← Workflow I/O (.zuko/workflows/*.json)

  engine/
    pipeline.ts      ← Pure function: execute a workflow (linear, soon DAG)

  commands/
    index.ts         ← Manifest: ZukoCommand interface, registerCommands(), getCommandMenuItems()
    run/
      index.ts       ← ZukoCommand for "run" (Commander setup, calls engine)
      tui.ts         ← Interactive run (clack prompts, spinners)
    create/
      index.ts       ← ZukoCommand for "create" + createWorkflow() pure function
      tui.ts         ← Interactive workflow creation wizard
    list/
      index.ts       ← ZukoCommand for "list" (no TUI needed)

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

`engine/pipeline.ts` is where pipeline execution lives. It currently runs nodes sequentially. When DAG support is added, the DAG logic goes here — commands and TUI don't change.
