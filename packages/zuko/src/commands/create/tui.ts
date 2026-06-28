import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { createWorkflow } from "./index.ts";

export default async function createTui(plugins: Map<string, AIPlugin>) {
  if (plugins.size === 0) {
    p.cancel("No active plugins found. Install a plugin before creating workflows.");
    return;
  }

  p.intro(pc.cyan("Setup New Workflow"));

  const metadata = await p.group(
    {
      name: () =>
        p.text({
          message: "Workflow Name",
          placeholder: "e.g., Code Reviewer Pipeline",
          validate: (v) => (!v.trim() ? "Name is required" : undefined),
        }),
      description: () =>
        p.text({
          message: "Description",
          placeholder: "What does this pipeline automate?",
          validate: (v) => (!v.trim() ? "Description is required" : undefined),
        }),
    },
    {
      onCancel: () => {
        p.cancel("Workflow creation aborted.");
        process.exit(0);
      },
    },
  );

  const pluginChoices = Array.from(plugins.entries()).map(([id, plugin]) => ({
    value: id,
    label: plugin.name,
  }));

  const nodes: Array<{
    name: string;
    pluginId: string;
    systemInstruction: string;
    modelId?: string;
    fallbackPluginId?: string;
  }> = [];

  let addMore = true;
  while (addMore) {
    const nodeIndex = nodes.length + 1;
    p.log.step(pc.magenta(`Node #${nodeIndex} Configuration`));

    const nodeConfig: any = await p.group(
      {
        name: () =>
          p.text({
            message: "Node Role / Name",
            placeholder: "e.g., Architect, Optimizer, Critic",
            validate: (v) => (!v.trim() ? "Node name is required" : undefined),
          }),
        pluginId: () =>
          p.select({
            message: "Primary AI Plugin",
            options: pluginChoices,
          }),
        modelId: () =>
          p.text({
            message: "Model ID (optional)",
            placeholder: "e.g., llama-3.3-70b-versatile",
          }),
        systemInstruction: () =>
          p.text({
            message: "System Prompt / Instructions",
            placeholder: "e.g., Act as a senior engineer.",
            validate: (v) =>
              !v.trim() ? "Context instructions are required" : undefined,
          }),
      },
      {
        onCancel: () => {
          addMore = false;
        },
      },
    );

    if (!nodeConfig) break;

    const fallbackChoice = await p.confirm({
      message: "Enable fallback routing for this node?",
      initialValue: false,
    });

    let fallbackPluginId: string | undefined;
    if (!p.isCancel(fallbackChoice) && fallbackChoice) {
      fallbackPluginId = (await p.select({
        message: "Select Backup Plugin",
        options: pluginChoices.filter((opt) => opt.value !== nodeConfig.pluginId),
      })) as string;
    }

    nodes.push({
      name: nodeConfig.name,
      pluginId: nodeConfig.pluginId,
      systemInstruction: nodeConfig.systemInstruction,
      modelId: nodeConfig.modelId || undefined,
      fallbackPluginId,
    });

    const nextAction = await p.select({
      message: "Pipeline Status",
      options: [
        { value: "add", label: "Add another execution node" },
        { value: "done", label: "Finish and compile workflow" },
      ],
    });

    if (p.isCancel(nextAction) || nextAction === "done") {
      addMore = false;
    }
  }

  if (nodes.length === 0) {
    p.cancel("Pipeline requires at least one node.");
    return;
  }

  const spinner = p.spinner();
  spinner.start("Compiling and storing workflow");
  const workflow = await createWorkflow({ name: metadata.name, description: metadata.description, nodes });
  spinner.stop(`${pc.green("✔")} Workflow compiled → .zuko/workflows/${workflow.id}.json`);

  p.outro(pc.bold("Ready to execute! 🚀"));
}
