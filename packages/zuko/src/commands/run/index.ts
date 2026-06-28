import type { ZukoCommand } from "../index.ts";
import { listWorkflows } from "../../storage.ts";
import { executeDag } from "../../engine/dag.ts";

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

        if (!options.prompt) {
          console.error("A prompt is required. Use -p or --prompt.");
          process.exit(1);
        }

        const result = await executeDag(workflow, options.prompt, plugins);
        if (result.success) {
          console.log(result.output);
        } else {
          console.error(result.error);
          process.exit(1);
        }
      });
  },
};
