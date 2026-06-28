import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AIPlugin } from "@sammybits/zuko-core";

export async function loadPlugins(): Promise<Map<string, AIPlugin>> {
  const plugins = new Map<string, AIPlugin>();

  for (const pkgName of await findPluginPackageNames()) {
    try {
      const mod = await import(pkgName);
      const plugin = (mod.default ?? mod) as AIPlugin;
      if (plugin && typeof plugin.execute === "function") {
        plugins.set(plugin.id, plugin);
      }
    } catch {
      // skip plugins that fail to load
    }
  }

  return plugins;
}

async function findPluginPackageNames(): Promise<string[]> {
  const fromNodeModules = await scanScopeDir();
  if (fromNodeModules.length > 0) return fromNodeModules;

  return scanWorkspacePackages();
}

/** Walk up from this file's location to find node_modules/@sammybits/ */
async function scanScopeDir(): Promise<string[]> {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== "/") {
    const candidate = path.join(dir, "node_modules", "@sammybits");
    if (existsSync(candidate)) {
      const entries = await readdir(candidate).catch(() => []);
      return entries
        .filter((e) => e.startsWith("zuko-plugin-"))
        .map((e) => `@sammybits/${e}`);
    }
    dir = path.dirname(dir);
  }
  return [];
}

/** Dev fallback: read package names from packages/plugin-* workspace dirs */
async function scanWorkspacePackages(): Promise<string[]> {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== "/") {
    const candidate = path.join(dir, "packages");
    if (existsSync(candidate)) {
      const dirs = await readdir(candidate).catch(() => []);
      const names: string[] = [];
      for (const d of dirs) {
        if (!d.startsWith("plugin-")) continue;
        try {
          const pkgJson = JSON.parse(
            await readFile(path.join(candidate, d, "package.json"), "utf-8"),
          );
          names.push(pkgJson.name);
        } catch {
          // skip
        }
      }
      return names;
    }
    dir = path.dirname(dir);
  }
  return [];
}
