import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { getCommandMenuItems } from "../commands/index.ts";
import { missingKeys } from "../config.ts";

export async function mainInteractive(plugins: Map<string, AIPlugin>) {
  const missing = missingKeys(plugins);
  if (missing.length > 0) {
    console.clear();
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
