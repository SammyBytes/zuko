import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { getCommandMenuItems } from "../commands/index.ts";

export async function mainInteractive(plugins: Map<string, AIPlugin>) {
  console.clear();

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

    p.log.message("");
    await p.confirm({
      message: "Finished reviewing execution. Back to main menu?",
      active: "Yes",
      placeholder: "Press Enter",
    });
    console.clear();
  }

  p.outro(pc.yellow("Bye! 🚀"));
}
