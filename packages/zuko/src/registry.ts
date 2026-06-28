import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AIPlugin } from "@sammybits/zuko-core";

/**
 * Internal configuration constants for locating and filtering plugins.
 * Eliminates the use of magic strings throughout the loading module.
 */
const CONSTANTS = Object.freeze({
  SCOPE_NAME: "@sammybits",
  PLUGIN_PREFIX: "zuko-plugin-",
  WORKSPACE_DIR: "packages",
  WORKSPACE_PREFIX: "plugin-",
  NODE_MODULES: "node_modules",
  PKG_JSON: "package.json",
  ENCODING_UTF8: "utf-8",
  ROOT_DIR: "/",
});

/**
 * Dynamically scans and imports plugins compatible with Zuko Core.
 * Searches both installed dependencies in `node_modules` and the monorepo/workspace structure.
 * 
 * @returns {Promise<Map<string, AIPlugin>>} A map indexed by the plugin's `id` and its corresponding instance.
 */
export async function loadPlugins(): Promise<Map<string, AIPlugin>> {
  const plugins = new Map<string, AIPlugin>();

  for (const specifier of await findPluginSpecifiers()) {
    try {
      const mod = await import(specifier);
      const plugin = (mod.default ?? mod) as AIPlugin;
      
      // Strict validation of the AIPlugin interface contract
      if (plugin && typeof plugin.execute === "function") {
        plugins.set(plugin.id, plugin);
      }
    } catch {
      // Safely skip plugins that fail to load or do not fulfill the interface
    }
  }

  return plugins;
}

/**
 * Coordinates the resolution of plugin import specifiers.
 * Prioritizes production/installed folder (node_modules) and falls back to local workspaces during development.
 * 
 * @returns {Promise<string[]>} A list of import specifiers (package names or file paths) ready to be dynamically imported.
 */
async function findPluginSpecifiers(): Promise<string[]> {
  const fromNodeModules = await scanScopeDir();
  if (fromNodeModules.length > 0) return fromNodeModules;

  return scanWorkspacePackages();
}

/**
 * Performs an upward traversal (looping towards root) from the current file's location
 * trying to locate the `node_modules/@sammybits` directory to list installed production plugins.
 * 
 * @returns {Promise<string[]>} List of package names (e.g., `["@sammybits/zuko-plugin-weather"]`).
 */
async function scanScopeDir(): Promise<string[]> {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  
  while (dir !== CONSTANTS.ROOT_DIR) {
    const candidate = path.join(dir, CONSTANTS.NODE_MODULES, CONSTANTS.SCOPE_NAME);
    
    if (existsSync(candidate)) {
      const entries = await readdir(candidate).catch(() => []);
      return entries
        .filter((e) => e.startsWith(CONSTANTS.PLUGIN_PREFIX))
        .map((e) => `${CONSTANTS.SCOPE_NAME}/${e}`);
    }
    dir = path.dirname(dir);
  }
  return [];
}

/**
 * Dev environment fallback (Monorepo).
 * Traverses upward looking for the `packages` directory, then reads the `package.json`
 * files from matching subdirectories that start with the designated workspace prefix.
 * Returns the actual entrypoint file path so Bun can resolve it without needing
 * the package to be a declared dependency.
 * 
 * @returns {Promise<string[]>} List of file paths to plugin entrypoints.
 */
async function scanWorkspacePackages(): Promise<string[]> {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  
  while (dir !== CONSTANTS.ROOT_DIR) {
    const candidate = path.join(dir, CONSTANTS.WORKSPACE_DIR);
    
    if (existsSync(candidate)) {
      const dirs = await readdir(candidate).catch(() => []);
      const paths: string[] = [];
      
      for (const d of dirs) {
        if (!d.startsWith(CONSTANTS.WORKSPACE_PREFIX)) continue;
        try {
          const pkgJsonPath = path.join(candidate, d, CONSTANTS.PKG_JSON);
          const pkgJson = JSON.parse(
            await readFile(pkgJsonPath, CONSTANTS.ENCODING_UTF8),
          );
          if (pkgJson.name) {
            const mainEntry = pkgJson.main || "./src/index.ts";
            paths.push(path.join(candidate, d, mainEntry));
          }
        } catch {
          // Silently skip unreadable directories or malformed package.json files
        }
      }
      return paths;
    }
    dir = path.dirname(dir);
  }
  return [];
}