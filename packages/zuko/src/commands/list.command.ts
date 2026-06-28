import type { ZukoCommand } from "./index.ts";
import { listWorkflows } from "../storage.ts";

export const listCommand: ZukoCommand = {
  name: "list",
  description: "List all available pipeline configurations",
  setup(program) {
    program
      .command("list")
      .description("List all available pipeline configurations")
      .action(async () => {
        const workflows = await listWorkflows();
        if (workflows.length === 0) {
          console.log("No workflows found.");
          return;
        }

        console.log(`Workflows (${workflows.length}):`);
        for (const w of workflows) {
          console.log(`  → ${w.name}  (${w.id}.json)`);
        }
      });
  },
};
