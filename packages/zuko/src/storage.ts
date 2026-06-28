import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Workflow } from "@sammybits/zuko-core";

/**
 * Internal configuration constants for managing workflow persistence.
 * Centralizes filesystem literals to prevent magic strings.
 */
const CONSTANTS = Object.freeze({
  DOT_ZUKO: ".zuko",
  WORKFLOWS: "workflows",
  JSON_EXT: ".json",
  ENCODING_UTF8: "utf-8",
  JSON_INDENT: 2,
});

/** Path to the local workflows directory inside the current working directory. */
const WORKFLOWS_DIR = path.join(
  process.cwd(),
  CONSTANTS.DOT_ZUKO,
  CONSTANTS.WORKFLOWS,
);

/**
 * Ensures that the target workflows directory exists on the filesystem.
 * Creates it recursively if it is missing.
 * 
 * @returns {Promise<void>}
 */
const ensureWorkflowsDirExists = async (): Promise<void> => {
  if (!existsSync(WORKFLOWS_DIR)) {
    await mkdir(WORKFLOWS_DIR, { recursive: true });
  }
};

/**
 * Persists a given workflow configuration as a formatted JSON file.
 * 
 * @param {Workflow} workflow - The workflow object to serialize and save.
 * @returns {Promise<void>}
 */
export const saveWorkflow = async (workflow: Workflow): Promise<void> => {
  await ensureWorkflowsDirExists();
  const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}${CONSTANTS.JSON_EXT}`);
  await writeFile(
    filePath,
    JSON.stringify(workflow, null, CONSTANTS.JSON_INDENT),
    CONSTANTS.ENCODING_UTF8,
  );
};

/**
 * Reads, parses, and lists all workflow configurations saved in the workflows directory.
 * 
 * @returns {Promise<Workflow[]>} An array containing all recovered Workflow instances.
 */
export const listWorkflows = async (): Promise<Workflow[]> => {
  await ensureWorkflowsDirExists();
  const files = await readdir(WORKFLOWS_DIR);
  const workflows: Workflow[] = [];

  for (const file of files) {
    if (file.endsWith(CONSTANTS.JSON_EXT)) {
      const filePath = path.join(WORKFLOWS_DIR, file);
      try {
        const content = await readFile(filePath, CONSTANTS.ENCODING_UTF8);
        workflows.push(JSON.parse(content));
      } catch {
        // Silently skip corrupted or unreadable JSON files
      }
    }
  }

  return workflows;
};