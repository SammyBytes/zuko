import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Workflow } from "./types";
import * as p from "@clack/prompts";
const WORKFLOWS_DIR = path.join(process.cwd(), ".zuko", "workflows");

const ensureWorkflowsDirExists = async () => {
  if (!existsSync(WORKFLOWS_DIR)) {
    p.log.info(`Creating missing workflows directory at ${WORKFLOWS_DIR}`);
    await mkdir(WORKFLOWS_DIR, { recursive: true });
  }
};
export const saveWorkflow = async (workflow: Workflow) => {
  await ensureWorkflowsDirExists();
  const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);

  try {
    p.log.info(`Saving workflow '${workflow.name}'`);
    await writeFile(filePath, JSON.stringify(workflow, null, 2), "utf-8");
    p.log.success(`Workflow '${workflow.name}' saved successfully`);
  } catch (error: any) {
    p.log.error(`Failed to save workflow '${workflow.name}': ${error.message}`);
    throw error;
  }
};
export const listWorkflows = async (): Promise<Workflow[]> => {
  await ensureWorkflowsDirExists();
  try {

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
  } catch (error: any) {
    p.log.error(`Failed to list workflows: ${error.message}`);
    return [];
  }
};
