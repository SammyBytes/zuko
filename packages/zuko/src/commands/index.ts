import type { Command } from "commander";
import type { CommandContext } from "@sammybits/zuko-core";
import { runCommand } from "./run/index.ts";
import { createCommand } from "./create/index.ts";
import { listCommand } from "./list/index.ts";

export interface ZukoCommand {
  name: string;
  description: string;
  setup: (program: Command, context: CommandContext) => void;
}

const commands: ZukoCommand[] = [runCommand, createCommand, listCommand];

/**
 * Returns menu items for the TUI layer.
 * Each item maps a command name to its display label and description.
 */
export function getCommandMenuItems() {
  return commands.map((cmd) => ({
    value: cmd.name,
    label: cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1),
    hint: cmd.description,
  }));
}

export function registerCommands(program: Command, context: CommandContext) {
  for (const cmd of commands) {
    cmd.setup(program, context);
  }
}
