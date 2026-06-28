import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Workflow } from "@sammybits/zuko-core";

const WORKFLOWS_DIR = path.join(process.cwd(), ".zuko", "workflows");

const ensureWorkflowsDirExists = async () => {
  if (!existsSync(WORKFLOWS_DIR)) {
    await mkdir(WORKFLOWS_DIR, { recursive: true });
  }
};

export const saveWorkflow = async (workflow: Workflow) => {
  await ensureWorkflowsDirExists();
  const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);
  await writeFile(filePath, JSON.stringify(workflow, null, 2), "utf-8");
};

export const listWorkflows = async (): Promise<Workflow[]> => {
  await ensureWorkflowsDirExists();
  const files = await readdir(WORKFLOWS_DIR);
  const workflows: Workflow[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      const filePath = path.join(WORKFLOWS_DIR, file);
      const content = await readFile(filePath, "utf-8");
      workflows.push(JSON.parse(content));
    }
  }

  return workflows;
};
