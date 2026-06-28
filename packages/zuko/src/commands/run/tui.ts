import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { listWorkflows } from "../../storage.ts";
import { executeDag, type DagCallbacks } from "../../engine/dag.ts";
import { showOutput } from "../../tui/shared.ts";

class TreeRenderer {
  private lines: string[] = [];
  private height = 0;

  private render() {
    if (this.height > 0) {
      process.stdout.write(`\x1b[${this.height}A`);
    }
    for (const line of this.lines) {
      process.stdout.write(`\r\x1b[K${line}\n`);
    }
    this.height = this.lines.length;
  }

  addLine(text: string): number {
    this.lines.push(text);
    this.render();
    return this.lines.length - 1;
  }

  updateLine(index: number, text: string) {
    this.lines[index] = text;
    this.render();
  }

  clear() {
    if (this.height > 0) {
      process.stdout.write(`\x1b[${this.height}A`);
      for (let i = 0; i < this.height; i++) {
        process.stdout.write(`\r\x1b[K\n`);
      }
      process.stdout.write(`\x1b[${this.height}A`);
    }
    this.lines = [];
    this.height = 0;
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
  p.log.step(`Running ${pc.green(workflow.name)}`);

  const renderer = new TreeRenderer();
  const nodeLineMap = new Map<string, number>();

  const callbacks: DagCallbacks = {
    onWaveStart(wave, nodeIds) {
      const suffix = nodeIds.length > 1 ? ` (${nodeIds.length} in parallel)` : "";
      renderer.addLine(pc.cyan(`⚡ Wave ${wave}${suffix}`));
    },

    onNodeStart(nodeId) {
      const node = workflow.nodes.find((n) => n.id === nodeId);
      const pluginName = node?.pluginId ?? "?";
      const lineIdx = renderer.addLine(
        `  ⏳ ${pc.bold(nodeId)} via ${pc.yellow(pluginName)}`,
      );
      nodeLineMap.set(nodeId, lineIdx);
    },

    onNodeComplete(nodeId, _text, duration) {
      const lineIdx = nodeLineMap.get(nodeId);
      if (lineIdx === undefined) return;
      const dur = `[${(duration / 1000).toFixed(1)}s]`;
      renderer.updateLine(lineIdx, `  ${pc.green("✓")} ${pc.bold(nodeId)} ${pc.dim(dur)}`);
    },

    onNodeError(nodeId, error) {
      const lineIdx = nodeLineMap.get(nodeId);
      if (lineIdx === undefined) return;
      renderer.updateLine(lineIdx, `  ${pc.red("✗")} ${pc.bold(nodeId)} ${pc.dim(error.message)}`);
    },
  };

  const result = await executeDag(workflow, prompt, plugins, callbacks);

  renderer.addLine("");

  if (!result.success) {
    p.log.error(result.error ?? "Unknown error");
    return;
  }

  if (result.warning) {
    p.log.warn(result.warning);
  }

  await showOutput(result.output ?? "");
}
