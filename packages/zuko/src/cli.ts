import * as p from "@clack/prompts";
import pc from "picocolors";
import { exec } from "node:child_process";
import { loadPlugins } from "./registry";
import { creatorWorkflow } from "./creator";
import { listWorkflows } from "./storage";
import type { AIPlugin } from "./types";

type PluginMap = Map<string, AIPlugin>;

// ─── Clipboard ────────────────────────────────────────────────────────────────

function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd =
      process.platform === "darwin"
        ? "pbcopy"
        : "xclip -selection clipboard 2>/dev/null || xsel --clipboard --input 2>/dev/null";

    const child = exec(cmd, (err) => resolve(!err));
    child.stdin?.write(text);
    child.stdin?.end();
  });
}

// ─── Output display ───────────────────────────────────────────────────────────

async function showOutput(result: string) {
  const width = Math.min(process.stdout.columns ?? 80, 80);
  const divider = pc.gray("─".repeat(width));

  p.log.message(`\n${divider}`);
  p.log.message(result);
  p.log.message(divider);

  const copied = await copyToClipboard(result);

  if (copied) {
    p.log.message(pc.gray("  ✓ Full pipeline output copied to clipboard"));
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export const handleList = async () => {
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
};

export async function handleRun(
  plugins: PluginMap,
  explicitId?: string,
  explicitPrompt?: string,
) {
  const workflows = await listWorkflows();
  if (workflows.length === 0) {
    p.log.error("No workflows found. Create one first.");
    return;
  }

  let workflowId = explicitId;
  if (!workflowId) {
    workflowId = (await p.select({
      message: "Select a workflow",
      options: workflows.map((w) => ({
        value: w.id,
        label: w.name,
        hint: w.description,
      })),
    })) as string;
    if (p.isCancel(workflowId)) return;
  }

  const workflow = workflows.find((w) => w.id === workflowId);
  if (!workflow) {
    p.log.error(`Workflow "${workflowId}" not found.`);
    return;
  }

  let prompt = explicitPrompt;
  if (!prompt) {
    const input = await p.text({
      message: "Prompt",
      placeholder: "What do you want to process?",
      validate: (v) =>
        v.trim() === "" ? "Prompt cannot be empty." : undefined,
    });
    if (p.isCancel(input)) return;
    prompt = input;
  }

  p.log.step(`Running ${pc.green(workflow.name)}`);
  
  // ─── LÓGICA DE MEMORIA ACUMULATIVA ───
  let currentInput = prompt;
  let accumulatedOutput = "";

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
      const nodeOutput = await plugin.execute(currentInput, node.systemInstruction);
      
      // Guardamos la respuesta estructurada en el reporte final para la UI
      accumulatedOutput += `\n${pc.cyan(pc.bold(`## 🚀 [Node: ${node.id}]`))}\n\n${nodeOutput}\n\n${pc.gray("─".repeat(40))}\n`;
      
      // El resultado de este modelo alimenta al siguiente de la cadena
      currentInput = nodeOutput; 
      
      s.stop(`${node.id} ✓`);
    } catch (err: any) {
      s.stop(`${node.id} ✗`);
      p.log.error(`Stopped at "${node.id}": ${err.message}`);
      return;
    }
  }

  // Desplegamos el árbol completo acumulado
  await showOutput(accumulatedOutput.trim());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pause() {
  p.log.message("");
  // Usamos confirm en lugar de text vacío para evitar romper el flujo del buffer TTY de Clack
  await p.confirm({
    message: "Finished reviewing execution. Back to main menu?",
    active: "Yes",
    placeholder: "Press Enter"
  });
  console.clear();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function mainInteractive(plugins: PluginMap) {
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