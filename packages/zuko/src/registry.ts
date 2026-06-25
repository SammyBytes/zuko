import type { AIPlugin } from "./types.ts";
import * as p from "@clack/prompts";
import pc from "picocolors";

// Explicitly import the production package 
import GroqPlugin from "@sammybits/zuko-plugin-groq";

export async function loadPlugins(): Promise<Map<string, AIPlugin>> {
  const plugins = new Map<string, AIPlugin>();
  const detailedErrors: string[] = [];

  try {
    // Resolve standard ESM default structures safely
    const plugin = (GroqPlugin as any)?.default || GroqPlugin;

    if (plugin && typeof plugin === "object" && "name" in plugin) {
      plugins.set("groq", plugin as AIPlugin);
    } else {
      throw new Error(`Invalid plugin structure (type: ${typeof plugin})`);
    }
  } catch (error: any) {
    detailedErrors.push(`groq: ${error.message}`);
  }

  // Diagnostic warning fallback
  if (plugins.size === 0 && detailedErrors.length > 0) {
    p.note(
      `${pc.yellow("Notice:")} Could not establish core link with integrated plugins.\n\n` +
        `${pc.bold("Diagnostic Output:")}\n` +
        detailedErrors.map((err) => `  ${pc.red("→")} ${err}`).join("\n"),
      "Ecosystem Alert",
    );
  }

  return plugins;
}