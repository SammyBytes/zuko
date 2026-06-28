import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { listWorkflows } from "../../storage.ts";
import { showOutput } from "../../tui/shared.ts";

export default async function runTui(plugins: Map<string, AIPlugin>) {
  const workflows = await listWorkflows();
  if (workflows.length === 0) {
    p.log.error("No workflows found. Create one first.");
    return;
  }

  const workflowId = (await p.select({
    message: "Select a workflow",
    options: workflows.map((w) => ({
      value: w.id,
      label: w.name,
      hint: w.description,
    })),
  })) as string;
  if (p.isCancel(workflowId)) return;

  const prompt = (await p.text({
    message: "Prompt",
    placeholder: "What do you want to process?",
    validate: (v) => (v.trim() === "" ? "Prompt cannot be empty." : undefined),
  })) as string;
  if (p.isCancel(prompt)) return;

  const workflow = workflows.find((w) => w.id === workflowId)!;
  p.log.step(`Running ${pc.green(workflow.name)}`);

  let currentInput = prompt;
  const parts: string[] = [];

  for (const node of workflow.nodes) {
    const plugin =
      plugins.get(node.pluginId) ??
      (node.fallbackPluginId ? plugins.get(node.fallbackPluginId) : undefined);

    if (!plugin) {
      p.log.error(`Aborted: no plugin for node "${node.id}".`);
      return;
    }

    const s = p.spinner();
    s.start(`${pc.cyan(node.id)} via ${pc.yellow(plugin.name)}`);

    try {
      const output = await plugin.execute(
        currentInput,
        node.systemInstruction,
        node.modelId,
      );

      parts.push(
        `\n${pc.cyan(pc.bold(`## 🚀 [Node: ${node.id}]`))}\n\n${output}\n\n${pc.gray("─".repeat(40))}\n`,
      );
      currentInput = output;
      s.stop(`${node.id} ✓`);
    } catch (err: any) {
      s.stop(`${node.id} ✗`);
      p.log.error(
        `${pc.red("Error:")} ${err.message}\n` +
          `  ${pc.dim("Try a different model or check your API key.")}`,
      );
      return;
    }
  }

  await showOutput(parts.join("").trim());
}
