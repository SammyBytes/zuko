import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { AIPlugin } from "@sammybits/zuko-core";

export interface ZukoConfig {
  apiKeys: Record<string, string>;
}

export interface MissingKeyInfo {
  envVar: string;
  description: string;
  pluginName: string;
}

const CONFIG_FILE = "config.json";
const ENCODING = "utf-8";

function getConfigDir(): string {
  const base =
    process.platform === "win32"
      ? process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
      : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "zuko");
}

function getConfigPath(): string {
  return path.join(getConfigDir(), CONFIG_FILE);
}

async function ensureConfigDir(): Promise<void> {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function loadConfig(): Promise<ZukoConfig> {
  const configPath = getConfigPath();
  try {
    const raw = await readFile(configPath, ENCODING);
    return JSON.parse(raw) as ZukoConfig;
  } catch {
    return { apiKeys: {} };
  }
}

export async function saveConfig(config: ZukoConfig): Promise<void> {
  await ensureConfigDir();
  const configPath = getConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), ENCODING);
  if (process.platform !== "win32") {
    await chmod(configPath, 0o600);
  }
}

export async function setApiKey(
  envVar: string,
  key: string,
): Promise<void> {
  const config = await loadConfig();
  config.apiKeys[envVar] = key;
  await saveConfig(config);
  process.env[envVar] = key;
}

export async function unsetApiKey(envVar: string): Promise<void> {
  const config = await loadConfig();
  delete config.apiKeys[envVar];
  await saveConfig(config);
  delete process.env[envVar];
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export function missingKeys(
  plugins: Map<string, AIPlugin>,
): MissingKeyInfo[] {
  const result: MissingKeyInfo[] = [];
  for (const plugin of plugins.values()) {
    if (!plugin.requiredEnvVars) continue;
    for (const [envVar, description] of Object.entries(
      plugin.requiredEnvVars,
    )) {
      if (!process.env[envVar]) {
        result.push({ envVar, description, pluginName: plugin.name });
      }
    }
  }
  return result;
}

export async function injectEnvFromConfig(): Promise<void> {
  const config = await loadConfig();
  for (const [key, value] of Object.entries(config.apiKeys)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
