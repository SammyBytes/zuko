import type { Workflow } from "@sammybits/zuko-core";
import type { ZukoCommand } from "../index.ts";
import { saveWorkflow, listWorkflows } from "../../storage.ts";
import { toSlug } from "../create/index.ts";

/**
 * Partial node definition for editing.
 * Fields are optional — omitted fields keep the original value.
 */
export interface NodeEdit {
  name: string;
  pluginId: string;
  systemInstruction: string;
  modelId?: string;
  fallbackPluginId?: string;
  dependsOn?: string[];
}

/**
 * Partial workflow edit input.
 * Only supplied fields are changed.
 */
export interface EditInput {
  name?: string;
  description?: string;
  nodes?: NodeEdit[];
}

/** Fetch all saved workflows for the selection menu. */
export async function fetchWorkflows(): Promise<Workflow[]> {
  return listWorkflows();
}

/** Load a single workflow by ID, or null if not found. */
export async function loadWorkflowById(id: string): Promise<Workflow | null> {
  const workflows = await listWorkflows();
  return workflows.find((w) => w.id === id) ?? null;
}

/**
 * Apply edits to an existing workflow and persist it.
 * Nodes are fully replaced if `input.nodes` is supplied; otherwise untouched.
 */
export async function updateWorkflow(
  original: Workflow,
  input: EditInput,
): Promise<Workflow> {
  const updated: Workflow = {
    id: original.id,
    name: input.name ?? original.name,
    description: input.description ?? original.description,
    nodes: input.nodes
      ? input.nodes.map((n) => ({
          id: toSlug(n.name),
          pluginId: n.pluginId,
          systemInstruction: n.systemInstruction,
          modelId: n.modelId,
          fallbackPluginId: n.fallbackPluginId || null,
          dependsOn: n.dependsOn,
        }))
      : original.nodes,
  };

  await saveWorkflow(updated);
  return updated;
}

export const editCommand: ZukoCommand = {
  name: "edit",
  description: "Edit an existing workflow configuration",
  setup(program) {
    program
      .command("edit")
      .description("Edit an existing workflow configuration")
      .argument("[workflowId]", "ID of the workflow to edit")
      .action(async (workflowId) => {
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
        console.log(
          `Editing "${workflow.name}" — use the TUI for interactive editing.`,
        );
        console.log(JSON.stringify(workflow, null, 2));
      });
  },
};
