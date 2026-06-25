#!/usr/bin/env bun
import { Command } from "commander";
import { handleRun,  } from "./cli";
import { creatorWorkflow } from "./creator";
import { loadPlugins } from "./registry";
import { mainInteractive } from "./cli";

const program = new Command();
const plugins = await loadPlugins();

program
  .name("zuko")
  .description("Multi-Model Prompt Pipeline CLI")
  .version("0.0.1");

// ─── Command: Run ────────────────────────────────────────────────────────────
program
  .command("run")
  .description("Execute a specific prompt workflow")
  .argument("[workflowId]", "ID of the workflow script (.json)")
  .option("-p, --prompt <text>", "Base prompt to pipe directly without prompting")
  .action(async (workflowId, options) => {
    await handleRun(plugins, workflowId, options.prompt);
    process.exit(0);
  });

// ─── Command: Create ──────────────────────────────────────────────────────────
program
  .command("create")
  .description("Build a new prompt workflow chain interactively")
  .action(async () => {
    await creatorWorkflow(plugins);
    process.exit(0);
  });

// ─── Command: List ────────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all available pipeline configurations")
  .action(async () => {
    await handleList();
    process.exit(0);
  });

// ─── Interactive  ──────────────────────────────────────────────────────
// If no arguments are provided, run the interactive menu 
if (!process.argv.slice(2).length) {
  await mainInteractive(plugins);
} else {
  program.parse(process.argv);
}