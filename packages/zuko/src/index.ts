#!/usr/bin/env bun
import { Command } from "commander";
import { loadPlugins } from "./registry.ts";
import { registerCommands } from "./commands/index.ts";
import { mainInteractive } from "./tui/index.ts";
import { injectEnvFromConfig } from "./config.ts";

const program = new Command();

program
  .name("zuko")
  .description("Multi-Model Prompt Pipeline CLI")
  .version("1.1.1");

await injectEnvFromConfig();
const plugins = await loadPlugins();
registerCommands(program, { plugins });

if (!process.argv.slice(2).length) {
  await mainInteractive(plugins);
} else {
  program.parse(process.argv);
}
