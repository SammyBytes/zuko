import type { AIPlugin, Workflow } from "@sammybits/zuko-core";
import type { ZukoCommand } from "./index.ts";
import { listWorkflows } from "../storage.ts";

interface RunResult {
  success: boolean;
  output?: string;
  error?: string;
}

async function runPipeline(
  workflow: Workflow,
  prompt: string,
  plugins: Map<string, AIPlugin>,
): Promise<RunResult> {
  let currentInput = prompt;
  const parts: string[] = [];

  for (const node of workflow.nodes) {
    const plugin =
      plugins.get(node.pluginId) ??
      (node.fallbackPluginId ? plugins.get(node.fallbackPluginId) : undefined);

    if (!plugin) {
      return {
        success: false,
        error: `No plugin found for node "${node.id}" (pluginId: ${node.pluginId})`,
      };
    }

    try {
      const output = await plugin.execute(
        currentInput,
        node.systemInstruction,
        node.modelId,
      );

      parts.push(`## [Node: ${node.id}]\n\n${output}`);
      currentInput = output;
    } catch (err: any) {
      return {
        success: false,
        error: `Node "${node.id}" failed: ${err.message}`,
      };
    }
  }

  return { success: true, output: parts.join("\n\n---\n\n") };
}

export const runCommand: ZukoCommand = {
  name: "run",
  description: "Execute a specific prompt workflow",
  setup(program, { plugins }) {
    program
      .command("run")
      .description("Execute a specific prompt workflow")
      .argument("[workflowId]", "ID of the workflow script (.json)")
      .option("-p, --prompt <text>", "Base prompt to pipe directly")
      .action(async (workflowId, options) => {
        const workflows = await listWorkflows();
        if (workflows.length === 0) {
          console.error("No workflows found. Create one first.");
          process.exit(1);
        }

        const id = workflowId || workflows[0].id;
        const workflow = workflows.find((w) => w.id === id);
        if (!workflow) {
          console.error(`Workflow "${id}" not found.`);
          process.exit(1);
        }

        const prompt = options.prompt;
        if (!prompt) {
          console.error("A prompt is required. Use -p or --prompt.");
          process.exit(1);
        }

        const result = await runPipeline(workflow, prompt, plugins);
        if (result.success) {
          console.log(result.output);
        } else {
          console.error(result.error);
          process.exit(1);
        }
      });
  },
};
