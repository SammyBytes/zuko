import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin, Workflow, WorkflowNode } from "@sammybits/zuko-core";
import { toSlug } from "../create/index.ts";
import { fetchWorkflows } from "./index.ts";
import { saveWorkflow } from "../../storage.ts";

export default async function editTui(plugins: Map<string, AIPlugin>) {
  const workflows = await fetchWorkflows();
  if (workflows.length === 0) {
    p.cancel("No workflows found. Create one first.");
    return;
  }

  p.intro(pc.cyan("Edit Workflow"));

  const selectedId = (await p.select({
    message: "Select a workflow to edit",
    options: workflows.map((w) => ({
      value: w.id,
      label: w.name,
      hint: `${w.nodes.length} node${w.nodes.length !== 1 ? "s" : ""} · ${w.id}`,
    })),
  })) as string;

  if (p.isCancel(selectedId)) return;

  let workflow = workflows.find((w) => w.id === selectedId)!;
  let dirty = false;
  let done = false;

  while (!done) {
    p.log.message("");
    p.log.message(renderDagPreview(workflow.nodes));
    p.log.message("");

    const action = (await p.select({
      message: `Editing "${workflow.name}" — what next?`,
      options: [
        { value: "name", label: "Edit name/description" },
        { value: "nodes", label: "Edit a node", hint: "Plugin, instruction, dependencies" },
        { value: "add", label: "Add a node" },
        { value: "remove", label: "Remove a node" },
        { value: "done", label: "Done — save & exit" },
      ],
    })) as string;

    if (p.isCancel(action)) {
      const confirmExit = await p.confirm({
        message: "Discard unsaved changes?",
        initialValue: false,
      });
      if (p.isCancel(confirmExit) || confirmExit) break;
      continue;
    }

    switch (action) {
      case "name": {
        const r = await editMetadata(workflow);
        if (r) { workflow = r; dirty = true; }
        break;
      }
      case "nodes": {
        const r = await editNodePicker(workflow, plugins);
        if (r) { workflow = r; dirty = true; }
        break;
      }
      case "add": {
        const r = await addNode(workflow, plugins);
        if (r) { workflow = r; dirty = true; }
        break;
      }
      case "remove": {
        const r = await removeNode(workflow);
        if (r) { workflow = r; dirty = true; }
        break;
      }
      case "done": {
        done = true;
        break;
      }
    }
  }

  if (dirty) {
    const spinner = p.spinner();
    spinner.start("Saving workflow");
    await saveWorkflow(workflow);
    spinner.stop(
      `${pc.green("✔")} Workflow saved → .zuko/workflows/${workflow.id}.json`,
    );
    p.outro(pc.bold("Done!"));
  } else {
    p.outro(pc.bold("No changes made."));
  }
}

/* ── Metadata editor ───────────────────────────────────── */

async function editMetadata(workflow: Workflow): Promise<Workflow | null> {
  const result = await p.group(
    {
      name: () =>
        p.text({
          message: "Workflow Name",
          initialValue: workflow.name,
          validate: (v) => (!v.trim() ? "Name is required" : undefined),
        }),
      description: () =>
        p.text({
          message: "Description",
          initialValue: workflow.description,
        }),
    },
    { onCancel: () => {} },
  );

  if (!result) return null;

  const { name, description } = result as { name: string; description: string };
  if (p.isCancel(name)) return null;

  return {
    ...workflow,
    name,
    description: description || "",
  };
}

/* ── Node picker ───────────────────────────────────────── */

async function editNodePicker(
  workflow: Workflow,
  plugins: Map<string, AIPlugin>,
): Promise<Workflow | null> {
  const choices = workflow.nodes.map((n, i) => ({
    value: i.toString(),
    label: `${i + 1}: ${n.id}`,
    hint: n.dependsOn?.length
      ? `depends on: ${n.dependsOn.join(", ")}`
      : "root node",
  }));

  const idx = (await p.select({
    message: "Select a node to edit",
    options: choices,
  })) as string;

  if (p.isCancel(idx)) return null;
  return editNodeForm(workflow, parseInt(idx), plugins);
}

/* ── Node editor form ──────────────────────────────────── */

async function editNodeForm(
  workflow: Workflow,
  idx: number,
  plugins: Map<string, AIPlugin>,
): Promise<Workflow | null> {
  const node = workflow.nodes[idx];
  const pluginChoices = Array.from(plugins.entries()).map(([id, plugin]) => ({
    value: id,
    label: plugin.name,
  }));

  const otherNodeChoices = workflow.nodes
    .filter((_, i) => i !== idx)
    .map((n) => ({
      value: n.id,
      label: n.id,
    }));

  const result = await p.group(
    {
      name: () =>
        p.text({
          message: "Node name (changes propagate to dependent nodes)",
          initialValue: node.id,
          validate: (v) => (!v.trim() ? "Name is required" : undefined),
        }),
      pluginId: () =>
        p.select({
          message: "Plugin",
          options: pluginChoices,
          initialValue: node.pluginId,
        }),
      systemInstruction: () =>
        p.text({
          message: "System instruction",
          initialValue: node.systemInstruction || "",
          validate: (v) =>
            !v.trim() ? "System instruction is required" : undefined,
        }),
      modelId: () =>
        p.text({
          message: "Model ID (optional — press Enter to skip)",
          initialValue: node.modelId || "",
        }),
    },
    { onCancel: () => {} },
  );

  if (!result) return null;

  const {
    name,
    pluginId,
    systemInstruction,
    modelId,
  } = result as {
    name: string;
    pluginId: string;
    systemInstruction: string;
    modelId: string;
  };

  if (p.isCancel(name)) return null;

  const oldSlug = node.id;
  const newSlug = toSlug(name);

  let dependsOn = node.dependsOn;

  // Ask about dependency changes if there are other nodes to depend on
  if (otherNodeChoices.length > 0) {
    const changeDeps = await p.confirm({
      message: dependsOn?.length
        ? `Change dependencies? Currently depends on: ${dependsOn.join(", ")}`
        : "Make this node depend on another? (currently a root node)",
      initialValue: false,
    });
    if (p.isCancel(changeDeps)) return null;

    if (changeDeps) {
      if (otherNodeChoices.length === 1) {
        const dep = await p.confirm({
          message: `Depend on "${otherNodeChoices[0].label}"?`,
          initialValue: dependsOn?.includes(otherNodeChoices[0].value) ?? false,
        });
        if (p.isCancel(dep)) return null;
        dependsOn = dep ? [otherNodeChoices[0].value] : [];
      } else {
        const selected = (await p.multiselect({
          message: "Select dependencies (upstream nodes)",
          options: otherNodeChoices,
          required: false,
          initialValues: dependsOn || [],
        })) as string[];
        if (p.isCancel(selected)) return null;
        dependsOn = selected.length > 0 ? selected : [];
      }
    }
  }

  // Ask about fallback plugin
  let fallbackPluginId: string | undefined;
  if (pluginChoices.length > 1) {
    const useFallback = await p.confirm({
      message: node.fallbackPluginId
        ? `Change fallback plugin? Current: ${node.fallbackPluginId}`
        : "Add a fallback plugin?",
      initialValue: !!node.fallbackPluginId,
    });
    if (p.isCancel(useFallback)) return null;

    if (useFallback) {
      fallbackPluginId = (await p.select({
        message: "Backup plugin",
        options: pluginChoices.filter((opt) => opt.value !== pluginId),
        initialValue: node.fallbackPluginId || undefined,
      })) as string;
      if (p.isCancel(fallbackPluginId)) return null;
    }
  }

  const updatedNodes: WorkflowNode[] = workflow.nodes.map((n, i) => {
    if (i === idx) {
      return {
        id: newSlug,
        pluginId,
        systemInstruction,
        modelId: modelId || undefined,
        fallbackPluginId: fallbackPluginId || null,
        dependsOn,
      };
    }
    // Update any references to the old node slug
    if (oldSlug !== newSlug && n.dependsOn?.includes(oldSlug)) {
      return {
        ...n,
        dependsOn: n.dependsOn.map((d) => (d === oldSlug ? newSlug : d)),
      };
    }
    return n;
  });

  return { ...workflow, nodes: updatedNodes };
}

/* ── Add node ──────────────────────────────────────────── */

async function addNode(
  workflow: Workflow,
  plugins: Map<string, AIPlugin>,
): Promise<Workflow | null> {
  const pluginChoices = Array.from(plugins.entries()).map(([id, plugin]) => ({
    value: id,
    label: plugin.name,
  }));

  const prevChoices = workflow.nodes.map((n) => ({
    value: n.id,
    label: n.id,
  }));

  const result: Record<string, string> | undefined = await p.group(
    {
      name: () =>
        p.text({
          message: "New node name",
          placeholder: "e.g., Optimizer, Auditor",
          validate: (v) => (!v.trim() ? "Name is required" : undefined),
        }),
      pluginId: () =>
        p.select({ message: "Plugin", options: pluginChoices }),
      systemInstruction: () =>
        p.text({
          message: "System instruction",
          placeholder: "e.g., Act as a senior code reviewer.",
          validate: (v) =>
            !v.trim() ? "System instruction is required" : undefined,
        }),
    },
    { onCancel: () => {} },
  );

  if (!result) return null;

  const { name, pluginId, systemInstruction } = result;

  let dependsOn: string[] | undefined;
  if (prevChoices.length === 0) {
    dependsOn = [];
  } else if (prevChoices.length === 1) {
    const dep = await p.confirm({
      message: `Depend on "${prevChoices[0].label}"?`,
      initialValue: true,
    });
    if (p.isCancel(dep)) return null;
    dependsOn = dep ? [prevChoices[0].value] : [];
  } else {
    const useDefault = await p.confirm({
      message: `Depend on previous node "${workflow.nodes[workflow.nodes.length - 1].id}"?`,
      initialValue: true,
    });
    if (p.isCancel(useDefault)) return null;
    if (useDefault) {
      dependsOn = [workflow.nodes[workflow.nodes.length - 1].id];
    } else {
      const selected = (await p.multiselect({
        message: "Select dependencies (upstream nodes)",
        options: prevChoices,
        required: false,
      })) as string[];
      if (p.isCancel(selected)) return null;
      dependsOn = selected.length > 0 ? selected : [];
    }
  }

  let fallbackPluginId: string | undefined;
  if (pluginChoices.length > 1) {
    const useFallback = await p.confirm({
      message: "Add a fallback plugin?",
      initialValue: false,
    });
    if (p.isCancel(useFallback)) return null;
    if (useFallback) {
      fallbackPluginId = (await p.select({
        message: "Backup plugin",
        options: pluginChoices.filter((opt) => opt.value !== pluginId),
      })) as string;
      if (p.isCancel(fallbackPluginId)) return null;
    }
  }

  const newNode: WorkflowNode = {
    id: toSlug(name),
    pluginId,
    systemInstruction,
    modelId: undefined,
    fallbackPluginId: fallbackPluginId || null,
    dependsOn,
  };

  return { ...workflow, nodes: [...workflow.nodes, newNode] };
}

/* ── Remove node ───────────────────────────────────────── */

async function removeNode(workflow: Workflow): Promise<Workflow | null> {
  const choices = workflow.nodes.map((n, i) => ({
    value: i.toString(),
    label: `${i + 1}: ${n.id}`,
  }));

  const idx = (await p.select({
    message: "Select a node to remove",
    options: choices,
  })) as string;

  if (p.isCancel(idx)) return null;

  const index = parseInt(idx);
  const node = workflow.nodes[index];

  // Check if other nodes depend on this one
  const dependents = workflow.nodes.filter(
    (n) => n.dependsOn?.includes(node.id),
  );

  if (dependents.length > 0) {
    const names = dependents.map((n) => n.id).join(", ");
    p.log.warn(
      `${dependents.length} node${dependents.length > 1 ? "s" : ""} depend${dependents.length === 1 ? "s" : ""} on "${node.id}": ${names}. They will lose this dependency.`,
    );

    const proceed = await p.confirm({
      message: `Remove "${node.id}" anyway?`,
      initialValue: false,
    });
    if (p.isCancel(proceed) || !proceed) return null;

    const updatedNodes = workflow.nodes
      .filter((_, i) => i !== index)
      .map((n) => ({
        ...n,
        dependsOn: n.dependsOn?.filter((dep) => dep !== node.id),
      }));

    return { ...workflow, nodes: updatedNodes };
  }

  const confirm = await p.confirm({
    message: `Remove "${node.id}"?`,
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) return null;
  return { ...workflow, nodes: workflow.nodes.filter((_, i) => i !== index) };
}

/* ── DAG tree preview ──────────────────────────────────── */

function renderDagPreview(nodes: WorkflowNode[]): string {
  if (nodes.length === 0) return "";

  const levels = new Map<string, number>();

  function levelOf(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const node = nodes.find((n) => n.id === id);
    if (!node || !node.dependsOn || node.dependsOn.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    const pl = Math.max(...node.dependsOn.map(levelOf));
    levels.set(id, pl + 1);
    return pl + 1;
  }

  for (const n of nodes) levelOf(n.id);

  const byLevel = new Map<number, string[]>();
  for (const [id, lvl] of levels) {
    const g = byLevel.get(lvl) || [];
    g.push(id);
    byLevel.set(lvl, g);
  }

  const lines: string[] = ["┌─ DAG Preview ──────────────────"];
  const maxLvl = Math.max(...byLevel.keys());
  for (let lvl = 0; lvl <= maxLvl; lvl++) {
    const g = byLevel.get(lvl);
    if (!g) continue;
    const indent = "  ".repeat(lvl);
    if (g.length === 1) {
      lines.push(`│ ${indent}└─ ${g[0]}`);
    } else {
      lines.push(`│ ${indent}├─ [parallel]`);
      for (const name of g) {
        lines.push(`│ ${indent}│  └─ ${name}`);
      }
    }
  }
  lines.push("└────────────────────────────────");

  return lines.join("\n");
}
