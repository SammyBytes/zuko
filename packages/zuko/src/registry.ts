import { readdir } from "node:fs/promises";
import path from "node:path";
import type { AIPlugin } from "@sammybits/zuko-core";

export async function loadPlugins(): Promise<Map<string, AIPlugin>> {
  const plugins = new Map<string, AIPlugin>();

  const scopeDir = path.join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "node_modules",
    "@sammybits",
  );

  let entries: string[];
  try {
    entries = await readdir(scopeDir);
  } catch {
    return plugins;
  }

  for (const pkgName of entries) {
    if (!pkgName.startsWith("zuko-plugin-")) continue;

    try {
      const mod = await import(`@sammybits/${pkgName}`);
      const plugin = (mod.default ?? mod) as AIPlugin;

      if (plugin && typeof plugin.execute === "function") {
        plugins.set(plugin.id, plugin);
      }
    } catch {
      // Plugin failed to load — skip silently
    }
  }

  return plugins;
}
