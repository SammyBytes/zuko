import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
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
  // 1) Published plugins installed in node_modules/@sammybits/zuko-plugin-*
  const fromNodeModules = await scanScopeDir();
  if (fromNodeModules.length > 0) return fromNodeModules;

  // 2) Dev fallback: scan workspace packages for plugin-* directories
  return scanWorkspacePackages();
}

async function scanScopeDir(): Promise<string[]> {
  const scopeDir = path.join(process.cwd(), "node_modules", "@sammybits");
  try {
    const entries = await readdir(scopeDir);
    return entries
      .filter((e) => e.startsWith("zuko-plugin-"))
      .map((e) => `@sammybits/${e}`);
  } catch {
    return [];
  }
}

async function scanWorkspacePackages(): Promise<string[]> {
  const packagesDir = path.join(process.cwd(), "packages");
  try {
    const dirs = await readdir(packagesDir);
    const names: string[] = [];

    for (const dir of dirs) {
      if (!dir.startsWith("plugin-")) continue;
      try {
        const pkgJson = JSON.parse(
          await readFile(path.join(packagesDir, dir, "package.json"), "utf-8"),
        );
        names.push(pkgJson.name);
      } catch {
        // skip if no valid package.json
      }
    }

    return names;
  } catch {
    return [];
  }
}
