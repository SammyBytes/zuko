import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { listWorkflows } from "../../storage.ts";
import { executeDag, type DagCallbacks } from "../../engine/dag.ts";
import { showOutput, copyToClipboard } from "../../tui/shared.ts";

class TreeRenderer {
  lines: string[] = [];
  nodeLines = new Map<string, number>();

  addLine(text: string): number {
    const idx = this.lines.length;
    this.lines.push(text);
    process.stdout.write(`${text}\n`);
    return idx;
  }

  updateLine(index: number, text: string) {
    this.lines[index] = text;
    const rowsUp = this.lines.length - index;
    process.stdout.write(`\x1b[s`);
    process.stdout.write(`\x1b[${rowsUp}A`);
    process.stdout.write(`\r\x1b[K${text}`);
    process.stdout.write(`\x1b[u`);
  }
}

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
  const startedAt = performance.now();

  p.log.step(`Running ${pc.green(workflow.name)}`);

  const renderer = new TreeRenderer();

  const callbacks: DagCallbacks = {
    onWaveStart(wave, nodeIds) {
      const suffix = nodeIds.length > 1 ? ` (${nodeIds.length} in parallel)` : "";
      renderer.addLine(pc.cyan(`⚡ Wave ${wave}${suffix}`));
    },

    onNodeStart(nodeId) {
      const node = workflow.nodes.find((n) => n.id === nodeId);
      const pluginName = node?.pluginId ?? "?";
      const idx = renderer.addLine(
        `  ⏳ ${nodeId} via ${pc.yellow(pluginName)}`,
      );
      renderer.nodeLines.set(nodeId, idx);
    },

    onNodeComplete(nodeId, _text, duration) {
      const idx = renderer.nodeLines.get(nodeId);
      if (idx === undefined) return;
      const dur = `[${(duration / 1000).toFixed(1)}s]`;
      renderer.updateLine(idx, `  ${pc.green("✓")} ${nodeId} ${pc.dim(dur)}`);
    },

    onNodeError(nodeId, error) {
      const idx = renderer.nodeLines.get(nodeId);
      if (idx === undefined) return;
      renderer.updateLine(idx, `  ${pc.red("✗")} ${nodeId} ${pc.dim(error.message)}`);
    },
  };

  const result = await executeDag(workflow, prompt, plugins, callbacks);
  const totalTime = (performance.now() - startedAt) / 1000;

  process.stdout.write(
    `\n${pc.green("✓") + pc.bold(` Workflow "${workflow.name}" completed in ${totalTime.toFixed(1)}s`)}\n\n`,
  );

  if (!result.success) {
    p.log.error(result.error ?? "Unknown error");
    return;
  }

  if (result.warning) {
    p.log.warn(result.warning);
  }

  showOutput(result.output ?? "");

  const action = (await p.select({
    message: "What now?",
    options: [
      { value: "back", label: "↩  Back to menu" },
      { value: "copy", label: "📋  Copy to clipboard" },
      { value: "exit", label: "✕  Exit" },
    ],
    initialValue: "back",
  })) as string;

  if (p.isCancel(action) || action === "back") return;

  if (action === "exit") {
    p.outro(pc.yellow("Bye! 🚀"));
    process.exit(0);
  }

  if (action === "copy") {
    copyToClipboard(result.output ?? "");
    p.log.success("✓ Copied!");
  }
}
