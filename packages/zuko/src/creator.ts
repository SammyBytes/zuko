import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Workflow, WorkflowNode, AIPlugin, AIPluginId } from "./types";
import { saveWorkflow } from "./storage";

export const creatorWorkflow = async (
  availablePlugins: Map<string, AIPlugin>,
) => {
  if (availablePlugins.size === 0) {
    p.cancel("No active plugins found. Install a plugin before creating workflows.");
    return;
  }

  p.intro(pc.cyan("Setup New Workflow"));

  const metadata = await p.group({
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
  });

  if (p.isCancel(metadata)) {
    p.cancel("Workflow creation aborted.");
    process.exit(0);
  }

  const idWorkflow = metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const nodes: WorkflowNode[] = [];
  const pluginChoices = Array.from(availablePlugins.entries()).map(([id, plugin]) => ({
    value: id as AIPluginId,
    label: plugin.name,
  }));

  let addMoreNodes = true;

  while (addMoreNodes) {
    const nodeIndex = nodes.length + 1;
    
    p.log.step(pc.magenta(`Node #${nodeIndex} Configuration`));

    const nodeConfig = await p.group({
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
      systemInstruction: () =>
        p.text({
          message: "System Prompt / Instructions",
          placeholder: "e.g., Act as a senior engineer. Refactor for performance.",
          validate: (v) => (!v.trim() ? "Context instructions are required" : undefined),
        }),
    });

    if (p.isCancel(nodeConfig)) break;

    const idNode = nodeConfig.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Inline fallback strategy check to prevent prompt depth fatigue
    let fallbackPluginId: AIPluginId | null = null;
    const assignFallback = await p.confirm({
      message: "Enable fallback routing for this node?",
      initialValue: false,
    });

    if (!p.isCancel(assignFallback) && assignFallback) {
      const fallbackChoice = await p.select({
        message: "Select Backup Plugin",
        options: pluginChoices.filter((opt) => opt.value !== nodeConfig.pluginId),
      });

      if (!p.isCancel(fallbackChoice)) {
        fallbackPluginId = fallbackChoice as AIPluginId;
      }
    }

    nodes.push({
      id: idNode,
      pluginId: nodeConfig.pluginId as AIPluginId,
      systemInstruction: nodeConfig.systemInstruction,
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
      addMoreNodes = false;
    }
  }

  if (nodes.length === 0) {
    p.cancel("Pipeline architecture requires at least one executable node.");
    return;
  }

  const newWorkflow: Workflow = {
    id: idWorkflow,
    name: metadata.name,
    description: metadata.description,
    nodes,
  };

  const spinner = p.spinner();
  spinner.start(`Compiling and storing [${pc.cyan(newWorkflow.name)}]`);
  await saveWorkflow(newWorkflow);
  spinner.stop(`${pc.green("✔")} Workflow compiled -> .zuko/workflows/${newWorkflow.id}.json`);
  
  p.outro(pc.bold("Ready to execute! 🚀"));
};