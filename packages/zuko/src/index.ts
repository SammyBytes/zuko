#!/usr/bin/env bun
import { Command } from "commander";
import { loadPlugins } from "./registry.ts";
import { registerCommands } from "./commands/index.ts";
import { mainInteractive } from "./tui/index.ts";

const program = new Command();

program
  .name("zuko")
  .description("Multi-Model Prompt Pipeline CLI")
  .version("1.0.2-alpha.1");

const plugins = await loadPlugins();
registerCommands(program, { plugins });

if (!process.argv.slice(2).length) {
  await mainInteractive(plugins);
} else {
  program.parse(process.argv);
}
