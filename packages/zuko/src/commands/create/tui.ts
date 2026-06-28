import * as p from "@clack/prompts";
import pc from "picocolors";
import type { AIPlugin } from "@sammybits/zuko-core";
import { createWorkflow, toSlug } from "./index.ts";
import { templates, type WorkflowTemplate } from "./templates.ts";

export default async function createTui(plugins: Map<string, AIPlugin>) {
  if (plugins.size === 0) {
    p.cancel("No active plugins found. Install a plugin before creating workflows.");
    return;
  }

  p.intro(pc.cyan("Create Workflow"));

  const templateChoice = (await p.select({
    message: "What kind of workflow do you want?",
    options: [
      ...templates.map((t) => ({
        value: t.id,
        label: t.name,
        hint: t.description,
      })),
      {
        value: "__custom__",
        label: "Custom (build your own DAG)",
        hint: "Full control over nodes, plugins, and dependencies",
      },
    ],
  })) as string;

  if (p.isCancel(templateChoice)) return;

  if (templateChoice === "__custom__") {
    await customWizard(plugins);
  } else {
    const template = templates.find((t) => t.id === templateChoice)!;
    await templateWizard(template, plugins);
  }
}

/* ── Template wizard ────────────────────────────────────── */

async function templateWizard(
  template: WorkflowTemplate,
  plugins: Map<string, AIPlugin>,
) {
  const pluginChoices = Array.from(plugins.entries()).map(([id, plugin]) => ({
    value: id,
    label: plugin.name,
  }));

  p.log.message(renderDagPreview(template.nodes));
  p.log.message("");

  const metadata = await p.group(
    {
      name: () =>
        p.text({
          message: "Workflow Name",
          placeholder: template.name,
          initialValue: template.name,
          validate: (v) => (!v.trim() ? "Name is required" : undefined),
        }),
      description: () =>
        p.text({
          message: "Description (optional)",
          placeholder: template.description,
          initialValue: template.description,
        }),
    },
    { onCancel: () => (p.cancel("Aborted."), process.exit(0)) },
  );

  const nodes = await customizeTemplateNodes(template, pluginChoices);

  const spinner = p.spinner();
  spinner.start("Saving workflow");
  const workflow = await createWorkflow({
    name: metadata.name,
    description: metadata.description,
    nodes,
  });
  spinner.stop(
    `${pc.green("✔")} Workflow saved → .zuko/workflows/${workflow.id}.json`,
  );
  p.outro(pc.bold("Ready to execute!"));
}

async function customizeTemplateNodes(
  template: WorkflowTemplate,
  pluginChoices: { value: string; label: string }[],
) {
  if (template.nodes.length <= 1) {
    return template.nodes.map((n) => ({
      name: n.name,
      pluginId: n.pluginId,
      systemInstruction: n.systemInstruction,
      dependsOn: n.dependsOn,
    }));
  }

  const customize = await p.confirm({
    message: "Customize node names and plugins?",
    initialValue: false,
  });
  if (p.isCancel(customize) || !customize) {
    return template.nodes.map((n) => ({
      name: n.name,
      pluginId: n.pluginId,
      systemInstruction: n.systemInstruction,
      dependsOn: n.dependsOn,
    }));
  }

  const customNames: string[] = [];
  for (const tn of template.nodes) {
    const name = (await p.text({
      message: `Node name (${tn.name})`,
      initialValue: tn.name,
      validate: (v) => (!v.trim() ? "Name is required" : undefined),
    })) as string;
    if (p.isCancel(name)) process.exit(0);
    customNames.push(name);
  }

  const pluginId = (await p.select({
    message: "Plugin for all nodes",
    options: pluginChoices,
  })) as string;
  if (p.isCancel(pluginId)) process.exit(0);

  const slugMap = new Map(
    template.nodes.map((tn, i) => [toSlug(tn.name), toSlug(customNames[i])]),
  );

  return template.nodes.map((tn, i) => ({
    name: customNames[i],
    pluginId,
    systemInstruction: tn.systemInstruction,
    dependsOn: tn.dependsOn?.map((dep) => slugMap.get(dep) || dep),
  }));
}

/* ── Custom DAG wizard ──────────────────────────────────── */

async function customWizard(plugins: Map<string, AIPlugin>) {
  const pluginChoices = Array.from(plugins.entries()).map(([id, plugin]) => ({
    value: id,
    label: plugin.name,
  }));

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
          message: "Description (optional)",
          placeholder: "What does this pipeline do?",
        }),
    },
    { onCancel: () => (p.cancel("Aborted."), process.exit(0)) },
  );

  const nodes: Array<{
    name: string;
    pluginId: string;
    systemInstruction: string;
    modelId?: string;
    fallbackPluginId?: string;
    dependsOn?: string[];
  }> = [];

  let addMore = true;
  while (addMore) {
    const idx = nodes.length + 1;
    p.log.step(pc.magenta(`Node #${idx}`));

    const prevChoices = nodes.map((n, i) => ({
      value: toSlug(n.name),
      label: `${i + 1}: ${n.name}`,
    }));

    const config: any = await p.group(
      {
        name: () =>
          p.text({
            message: "Node name",
            placeholder: "e.g., Architect, Optimizer, Critic",
            validate: (v) => (!v.trim() ? "Name is required" : undefined),
          }),
        pluginId: () =>
          p.select({ message: "Plugin", options: pluginChoices }),
        systemInstruction: () =>
          p.text({
            message: "System instruction",
            placeholder: "e.g., Act as a senior engineer.",
            validate: (v) =>
              !v.trim() ? "System instruction is required" : undefined,
          }),
      },
      { onCancel: () => (addMore = false) },
    );

    if (!config) break;

    let dependsOn: string[] | undefined;
    if (nodes.length === 0) {
      dependsOn = [];
    } else {
      const useDefault = await p.confirm({
        message: `Depend on previous node "${nodes[nodes.length - 1].name}"?`,
        initialValue: true,
      });
      if (p.isCancel(useDefault)) break;

      if (useDefault) {
        dependsOn = [toSlug(nodes[nodes.length - 1].name)];
      } else {
        const selected = (await p.multiselect({
          message: "Select dependencies (upstream nodes)",
          options: prevChoices,
          required: true,
        })) as string[];
        if (p.isCancel(selected)) break;
        dependsOn = selected;
      }
    }

    let fallbackPluginId: string | undefined;
    if (pluginChoices.length > 1) {
      const useFallback = await p.confirm({
        message: "Add a fallback plugin?",
        initialValue: false,
      });
      if (p.isCancel(useFallback)) break;

      if (useFallback) {
        fallbackPluginId = (await p.select({
          message: "Backup plugin",
          options: pluginChoices.filter(
            (opt) => opt.value !== config.pluginId,
          ),
        })) as string;
      }
    }

    nodes.push({
      name: config.name,
      pluginId: config.pluginId,
      systemInstruction: config.systemInstruction,
      fallbackPluginId,
      dependsOn,
    });

    p.log.message(renderDagPreview(nodes));

    const nextAction = (await p.select({
      message: "Next step",
      options: [
        { value: "add", label: "Add another node" },
        { value: "done", label: "Finish and save" },
      ],
    })) as string;

    if (p.isCancel(nextAction) || nextAction === "done") {
      addMore = false;
    }
  }

  if (nodes.length === 0) {
    p.cancel("Workflow must have at least one node.");
    return;
  }

  const spinner = p.spinner();
  spinner.start("Saving workflow");
  const workflow = await createWorkflow({
    name: metadata.name,
    description: metadata.description || "",
    nodes,
  });
  spinner.stop(
    `${pc.green("✔")} Workflow saved → .zuko/workflows/${workflow.id}.json`,
  );

  p.outro(pc.bold("Ready to execute!"));
}

/* ── DAG tree preview ───────────────────────────────────── */

function renderDagPreview(
  nodes: Array<{ name: string; dependsOn?: string[] }>,
): string {
  if (nodes.length === 0) return "";

  const slugName = new Map(nodes.map((n) => [toSlug(n.name), n.name]));
  const levels = new Map<string, number>();

  function levelOf(slug: string): number {
    if (levels.has(slug)) return levels.get(slug)!;
    const node = nodes.find((n) => toSlug(n.name) === slug);
    if (!node || !node.dependsOn || node.dependsOn.length === 0) {
      levels.set(slug, 0);
      return 0;
    }
    const pl = Math.max(...node.dependsOn.map(levelOf));
    levels.set(slug, pl + 1);
    return pl + 1;
  }

  for (const n of nodes) levelOf(toSlug(n.name));

  const byLevel = new Map<number, string[]>();
  for (const [slug, lvl] of levels) {
    const g = byLevel.get(lvl) || [];
    g.push(slugName.get(slug)!);
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
