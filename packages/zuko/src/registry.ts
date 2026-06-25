import type { AIPlugin } from "./types";
import * as p from "@clack/prompts";
import pc from "picocolors";

const PLUGINS_SUPPORTED = [
  { id: "groq", pkg: "@zuko/plugin-groq" },
  { id: "gemini", pkg: "@zuko/plugin-gemini" },
  { id: "claude", pkg: "@zuko/plugin-claude" },
];

export async function loadPlugins(): Promise<Map<string, AIPlugin>> {
  const plugins = new Map<string, AIPlugin>();
  const detailedErrors: string[] = [];

  for (const { id, pkg } of PLUGINS_SUPPORTED) {
    try {
      const module = await import(pkg);
      // Automatically resolves nested default exports (.default.default)
      const plugin = module?.default?.default || module?.default || module;

      if (plugin && typeof plugin === "object" && "name" in plugin) {
        plugins.set(id, plugin as AIPlugin);
      } else {
        throw new Error(`Invalid module structure (type: ${typeof plugin})`);
      }
    } catch (error: any) {
      detailedErrors.push(`${id}: ${error.message}`);
    }
  }

  if (plugins.size === 0 && detailedErrors.length > 0) {
    p.note(
      `${pc.yellow("Notice:")} Could not establish hot-link with compiled packages.\n\n` +
        `${pc.bold("Diagnostic Output:")}\n` +
        detailedErrors.map((err) => `  ${pc.red("→")} ${err}`).join("\n") + "\n\n" +
        `Ensure plugins are built and linked in your package.json dependencies.`,
      "Ecosystem Alert",
    );
  }

  return plugins;
}