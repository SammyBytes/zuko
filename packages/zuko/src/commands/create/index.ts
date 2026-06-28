import type { Workflow } from "@sammybits/zuko-core";
import type { ZukoCommand } from "../index.ts";
import { saveWorkflow } from "../../storage.ts";

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CreateInput {
  name: string;
  description?: string;
  nodes: Array<{
    name: string;
    pluginId: string;
    systemInstruction: string;
    modelId?: string;
    fallbackPluginId?: string;
    dependsOn?: string[];
  }>;
}

export async function createWorkflow(input: CreateInput): Promise<Workflow> {
  const id = toSlug(input.name);
  const workflow: Workflow = {
    id,
    name: input.name,
    description: input.description || "",
    nodes: input.nodes.map((n) => ({
      id: toSlug(n.name),
      pluginId: n.pluginId,
      systemInstruction: n.systemInstruction,
      modelId: n.modelId,
      fallbackPluginId: n.fallbackPluginId || null,
      dependsOn: n.dependsOn,
    })),
  };

  await saveWorkflow(workflow);
  return workflow;
}

export const createCommand: ZukoCommand = {
  name: "create",
  description: "Create a new workflow definition (non-interactive)",
  setup(program) {
    program
      .command("create")
      .description("Create a new workflow from CLI arguments")
      .option("--name <name>", "Workflow name")
      .option("--description <desc>", "Workflow description")
      .option("--node-name <name>", "Node name", collect)
      .option("--node-plugin <id>", "Plugin ID for node", collect)
      .option("--node-instruction <text>", "System instruction for node", collect)
      .option("--node-model <id>", "Model ID for node", collect)
      .action(async (options) => {
        if (!options.name) {
          console.error("Workflow name is required (--name).");
          process.exit(1);
        }

        const names: string[] = options.nodeName || [];
        const pluginIds: string[] = options.nodePlugin || [];
        const instructions: string[] = options.nodeInstruction || [];
        const models: (string | undefined)[] = options.nodeModel || [];

        if (names.length === 0) {
          console.error("At least one node is required (--node-name).");
          process.exit(1);
        }

        const workflow = await createWorkflow({
          name: options.name,
          description: options.description,
          nodes: names.map((name, i) => ({
            name,
            pluginId: pluginIds[i] || "groq",
            systemInstruction: instructions[i] || "",
            modelId: models[i],
          })),
        });

        console.log(`Workflow saved → .zuko/workflows/${workflow.id}.json`);
      });
  },
};

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
