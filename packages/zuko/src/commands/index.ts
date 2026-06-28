import type { Command } from "commander";
import type { CommandContext } from "@sammybits/zuko-core";
import { runCommand } from "./run.command.ts";
import { createCommand } from "./create.command.ts";
import { listCommand } from "./list.command.ts";

export interface ZukoCommand {
  name: string;
  description: string;
  setup: (program: Command, context: CommandContext) => void;
}

const commands: ZukoCommand[] = [runCommand, createCommand, listCommand];

export function registerCommands(program: Command, context: CommandContext) {
  for (const cmd of commands) {
    cmd.setup(program, context);
  }
}
