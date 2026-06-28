import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { runPipeline } from "../commands/run.command.ts";
import { createWorkflow } from "../commands/create.command.ts";
import { listWorkflows } from "../storage.ts";
import { copyToClipboard, showOutput } from "./shared.ts";

export async function mainInteractive(plugins: Map<string, AIPlugin>) {
  console.clear();

  while (true) {
    p.intro(
      `${pc.bgRed(pc.black(" ZUKO "))} ${pc.bold("Multi-Model Prompt Pipeline")}`,
    );

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
        await runTui(plugins);
        break;
      case "create":
        await createTui(plugins);
        break;
      case "list":
        await listTui();
        break;
    }

    await pause();
  }

  p.outro(pc.yellow("Bye! 🚀"));
}

async function runTui(plugins: Map<string, AIPlugin>) {
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
  let accumulated = "";

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
      accumulated += `\n${pc.cyan(pc.bold(`## 🚀 [Node: ${node.id}]`))}\n\n${output}\n\n${pc.gray("─".repeat(40))}\n`;
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

  await showOutput(accumulated.trim());
}

async function createTui(plugins: Map<string, AIPlugin>) {
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
  const workflow = await createWorkflow({
    name: metadata.name,
    description: metadata.description,
    nodes,
  });
  spinner.stop(
    `${pc.green("✔")} Workflow compiled → .zuko/workflows/${workflow.id}.json`,
  );

  p.outro(pc.bold("Ready to execute! 🚀"));
}

async function listTui() {
  const workflows = await listWorkflows();
  if (workflows.length === 0) {
    p.log.warn("No workflows found. Create one first.");
    return;
  }
  p.log.message(
    `${pc.bold("Workflows")} ${pc.gray(`(${workflows.length})`)}`,
  );
  for (const w of workflows) {
    p.log.message(
      `  ${pc.cyan("→")} ${pc.bold(w.name)} ${pc.gray(w.id + ".json")}`,
    );
  }
}

async function pause() {
  p.log.message("");
  await p.confirm({
    message: "Finished reviewing execution. Back to main menu?",
    active: "Yes",
    placeholder: "Press Enter",
  });
  console.clear();
}
