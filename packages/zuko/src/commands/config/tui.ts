import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import {
  loadConfig,
  saveConfig,
  maskKey,
  missingKeys,
} from "../../config.ts";

export default async function configTui(
  plugins: Map<string, AIPlugin>,
): Promise<void> {
  p.intro(pc.cyan("API Key Configuration"));

  const missing = missingKeys(plugins);

  let done = false;
  while (!done) {
    const config = await loadConfig();
    const known = gatherKnownVars(plugins, config);

    p.log.message("");
    p.log.message(renderKeyStatus(known));
    p.log.message("");

    const action = (await p.select({
      message: "What would you like to do?",
      options: [
        {
          value: "set",
          label: "Set / change a key",
          hint: missing.length > 0 ? `${missing.length} missing` : undefined,
        },
        { value: "remove", label: "Remove a key" },
        { value: "done", label: "Done" },
      ],
    })) as string;

    if (p.isCancel(action)) break;

    switch (action) {
      case "set":
        await setKeyWizard(plugins, config);
        break;
      case "remove":
        await removeKeyWizard(config);
        break;
      case "done":
        done = true;
        break;
    }
  }

  const remaining = missingKeys(plugins);
  if (remaining.length > 0) {
    p.log.warn(
      `${remaining.length} key${remaining.length > 1 ? "s" : ""} still missing: ${remaining.map((m) => m.envVar).join(", ")}`,
    );
  }

  p.outro(pc.bold("Done!"));
}

/* ── Helpers ───────────────────────────────────────────── */

interface KnownVar {
  envVar: string;
  description: string;
  pluginName: string;
  configured: boolean;
  maskedValue: string;
}

function gatherKnownVars(
  plugins: Map<string, AIPlugin>,
  config: { apiKeys: Record<string, string> },
): KnownVar[] {
  const result: KnownVar[] = [];

  for (const plugin of plugins.values()) {
    if (!plugin.requiredEnvVars) continue;
    for (const [envVar, desc] of Object.entries(plugin.requiredEnvVars)) {
      const stored = config.apiKeys[envVar] || process.env[envVar] || "";
      result.push({
        envVar,
        description: desc,
        pluginName: plugin.name,
        configured: !!stored,
        maskedValue: stored ? maskKey(stored) : "",
      });
    }
  }

  return result;
}

function renderKeyStatus(vars: KnownVar[]): string {
  if (vars.length === 0) {
    return pc.dim("No plugins declare required API keys.");
  }

  const lines: string[] = ["┌─ API Keys ──────────────────────"];
  for (const v of vars) {
    const status = v.configured
      ? pc.green("✓ " + v.maskedValue)
      : pc.red("✗ not set");
    lines.push(
      `│ ${v.pluginName} · ${v.envVar}: ${status}`,
    );
  }
  lines.push("└────────────────────────────────");
  return lines.join("\n");
}

async function setKeyWizard(
  plugins: Map<string, AIPlugin>,
  config: { apiKeys: Record<string, string> },
): Promise<void> {
  const choices: { value: string; label: string; hint: string }[] = [];

  for (const plugin of plugins.values()) {
    if (!plugin.requiredEnvVars) continue;
    for (const [envVar, desc] of Object.entries(plugin.requiredEnvVars)) {
      const stored = config.apiKeys[envVar] || process.env[envVar] || "";
      choices.push({
        value: envVar,
        label: `${plugin.name} · ${envVar}`,
        hint: stored ? `current: ${maskKey(stored)}` : desc,
      });
    }
  }

  if (choices.length === 0) {
    p.log.warn("No plugins declare any required API keys.");
    return;
  }

  const selected = (await p.select({
    message: "Select an API key to configure",
    options: choices,
  })) as string;

  if (p.isCancel(selected)) return;

  const key = (await p.text({
    message: `Enter ${selected}`,
    placeholder: "sk-...",
    validate: (v) => (!v.trim() ? "Key cannot be empty" : undefined),
  })) as string;

  if (p.isCancel(key)) return;

  // Save to config and inject into process.env
  const updated = { ...config };
  updated.apiKeys[selected] = key;
  await saveConfig(updated);
  process.env[selected] = key;

  p.log.success(`${selected} saved successfully.`);
}

async function removeKeyWizard(config: {
  apiKeys: Record<string, string>;
}): Promise<void> {
  const entries = Object.entries(config.apiKeys);
  if (entries.length === 0) {
    p.log.info("No keys configured yet.");
    return;
  }

  const choices = entries.map(([envVar, value]) => ({
    value: envVar,
    label: envVar,
    hint: maskKey(value),
  }));

  const selected = (await p.select({
    message: "Select a key to remove",
    options: choices,
  })) as string;

  if (p.isCancel(selected)) return;

  const confirm = await p.confirm({
    message: `Remove ${selected}?`,
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) return;

  const updated = { ...config };
  delete updated.apiKeys[selected];
  await saveConfig(updated);
  delete process.env[selected];

  p.log.success(`${selected} removed.`);
}
