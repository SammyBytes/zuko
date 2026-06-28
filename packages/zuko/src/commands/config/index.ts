import type { ZukoCommand } from "../index.ts";
import { loadConfig, setApiKey, unsetApiKey, maskKey } from "../../config.ts";
import type { Command } from "commander";

export const configCommand: ZukoCommand = {
  name: "config",
  description: "Manage API keys for AI providers",
  setup(program: Command) {
    const configCmd = program
      .command("config")
      .description("Manage API keys for AI providers")
      .action(() => {
        program.help();
      });

    configCmd
      .command("set <envVar>")
      .description("Set an API key")
      .requiredOption("-k, --key <value>", "API key value")
      .action(async (envVar: string, options: { key: string }) => {
        const key = options.key.trim();
        if (!key) {
          console.error("Key value cannot be empty.");
          process.exit(1);
        }
        await setApiKey(envVar.toUpperCase(), key);
        console.log(`✓ ${envVar.toUpperCase()} saved to config`);
      });

    configCmd
      .command("list")
      .description("List configured API keys")
      .action(async () => {
        const config = await loadConfig();
        const entries = Object.entries(config.apiKeys);
        if (entries.length === 0) {
          console.log("No API keys configured.");
          return;
        }
        for (const [key, value] of entries) {
          console.log(`${key}=${maskKey(value)}`);
        }
      });

    configCmd
      .command("unset <envVar>")
      .description("Remove an API key")
      .action(async (envVar: string) => {
        await unsetApiKey(envVar.toUpperCase());
        console.log(`✓ ${envVar.toUpperCase()} removed from config`);
      });
  },
};
