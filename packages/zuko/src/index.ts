import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadPlugins } from "./registry";
import { creatorWorkflow } from "./creator";
import { listWorkflows } from "./storage";
import type { AIPlugin, AIPluginId } from "./types";

type PluginMap = Map<string, AIPlugin>;

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleList() {
  const workflows = await listWorkflows();

  if (workflows.length === 0) {
    p.log.warn("No workflows found. Create one first.");
    return;
  }

  p.log.message(`${pc.bold("Workflows")} ${pc.gray(`(${workflows.length})`)}`);
  for (const w of workflows) {
    p.log.message(
      `  ${pc.cyan("→")} ${pc.bold(w.name)} ${pc.gray(w.id + ".json")}`,
    );
  }
}

async function handleRun(plugins: PluginMap) {
  const workflows = await listWorkflows();

  if (workflows.length === 0) {
    p.log.error("No workflows found. Create one first.");
    return;
  }

  const workflowId = await p.select({
    message: "Select a workflow",
    options: workflows.map((w) => ({
      value: w.id,
      label: w.name,
      hint: w.description,
    })),
  });
  if (p.isCancel(workflowId)) return;

  const workflow = workflows.find((w) => w.id === workflowId)!;

  const prompt = await p.text({
    message: "Prompt",
    placeholder: "What do you want to process?",
    validate: (v) => (v.trim() === "" ? "Prompt cannot be empty." : undefined),
  });
  if (p.isCancel(prompt)) return;

  p.log.step(`Running ${pc.green(workflow.name)}`);

  let result = prompt;

  for (const node of workflow.nodes) {
    const plugin = resolvePlugin(plugins, node.pluginId, node.fallbackPluginId);

    if (!plugin) {
      p.log.error(`Aborted: no plugin found for node "${node.id}".`);
      return;
    }

    const s = p.spinner();
    s.start(`${pc.cyan(node.id)} via ${pc.yellow(plugin.name)}`);

    try {
      result = await plugin.execute(result, node.systemInstruction);
      s.stop(`${node.id} ✓`);
    } catch (err: any) {
      s.stop(`${node.id} ✗`);
      p.log.error(`Pipeline stopped at "${node.id}": ${err.message}`);
      return;
    }
  }

  p.log.message(`\n${pc.bgGreen(pc.black(" OUTPUT "))}\n\n${result}\n`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolvePlugin(
  plugins: PluginMap,
  id: AIPluginId,
  fallbackId?: AIPluginId | null,
) {
  return plugins.get(id) ?? (fallbackId ? plugins.get(fallbackId) : undefined);
}

async function pause() {
  await p.text({ message: "Press Enter to continue...", placeholder: "" });
  console.clear();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  p.intro(
    `${pc.bgRed(pc.black(" ZUKO "))} ${pc.bold("Multi-Model Prompt Pipeline")}`,
  );

  const plugins = await loadPlugins();

  while (true) {
    const command = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "run", label: "Run a workflow" },
        { value: "create", label: "Create a workflow" },
        { value: "list", label: "List workflows" },
        { value: "exit", label: "Exit" },
      ],
    });

    if (p.isCancel(command) || command === "exit") break;

    switch (command) {
      case "run":
        await handleRun(plugins);
        break;
      case "create":
        await creatorWorkflow(plugins);
        break;
      case "list":
        await handleList();
        break;
    }

    await pause();
  }

  p.outro(pc.yellow("Bye! 🚀"));
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
