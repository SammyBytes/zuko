import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { getCommandMenuItems } from "../commands/index.ts";
import {
  missingKeys,
  envKeysNotInConfig,
  saveConfig,
  loadConfig,
} from "../config.ts";

export async function mainInteractive(plugins: Map<string, AIPlugin>) {
  console.clear();

  // Phase 1: detect missing keys and offer to configure them
  const missing = missingKeys(plugins);
  if (missing.length > 0) {
    p.intro(pc.cyan("Welcome to Zuko"));
    p.log.warn(
      `${missing.length > 1 ? "Some API keys are" : "An API key is"} required but not configured:\n` +
        missing
          .map(
            (m) => `  · ${m.envVar} — ${m.description} (needed by ${m.pluginName})`,
          )
          .join("\n"),
    );

    const configure = await p.confirm({
      message: "Configure now?",
      initialValue: true,
    });

    if (p.isCancel(configure)) return;

    if (configure) {
      const mod = await import("../commands/config/tui.ts");
      await mod.default(plugins);
    }

    console.clear();
  }

  // Phase 2: detect keys set via env but not persisted in config, offer to save
  const envKeys = await envKeysNotInConfig(plugins);
  if (envKeys.length > 0) {
    p.intro(pc.cyan("Welcome to Zuko"));
    p.log.info(
      `${envKeys.length > 1 ? "Some API keys are" : "An API key is"} set in your environment but not saved to the config file:\n` +
        envKeys
          .map(
            (m) =>
              `  · ${m.envVar} (needed by ${m.pluginName})`,
          )
          .join("\n"),
    );

    const save = await p.confirm({
      message: "Save to config so you don't need to export it every session?",
      initialValue: true,
    });

    if (!p.isCancel(save) && save) {
      const config = await loadConfig();
      for (const key of envKeys) {
        config.apiKeys[key.envVar] = process.env[key.envVar]!;
      }
      await saveConfig(config);
      p.log.success("Keys saved to config file.");
    }

    console.clear();
  }

  while (true) {
    p.intro(
      `${pc.bgRed(pc.black(" ZUKO "))} ${pc.bold("Multi-Model Prompt Pipeline")}`,
    );

    const items = getCommandMenuItems();
    const command = await p.select({
      message: "What would you like to do?",
      options: [
        ...items.map((item) => ({
          value: item.value,
          label: item.label,
          hint: item.hint,
        })),
        { value: "exit", label: "Exit" },
      ],
    });

    if (p.isCancel(command) || command === "exit") break;

    try {
      const mod = await import(`../commands/${command}/tui.ts`);
      if (typeof mod.default === "function") {
        await mod.default(plugins);
      }
    } catch {
      p.log.error(`No interactive mode available for "${command}".`);
    }

    console.clear();
  }

  p.outro(pc.yellow("Bye! 🚀"));
}
