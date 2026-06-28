import type { AIPlugin, Workflow, WorkflowNode } from "@sammybits/zuko-core";

export interface DagNodeOutput {
  nodeId: string;
  text: string;
  duration: number;
}

export interface DagResult {
  success: boolean;
  output?: string;
  warning?: string;
  nodeOutputs: DagNodeOutput[];
  executionTrace: { wave: number; nodeId: string; duration: number }[];
  error?: string;
  failedNode?: string;
}

export interface DagCallbacks {
  onWaveStart?: (wave: number, nodeIds: string[]) => void;
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string, text: string, duration: number) => void;
  onNodeError?: (nodeId: string, error: Error) => void;
}

interface DepGraph {
  indegrees: Map<string, number>;
  adjList: Map<string, string[]>;
}

function buildDepGraph(nodes: WorkflowNode[]): DepGraph {
  const indegrees = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of nodes) {
    indegrees.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const node of nodes) {
    if (node.dependsOn) {
      for (const dep of node.dependsOn) {
        const deps = adjList.get(dep);
        if (deps) deps.push(node.id);
        indegrees.set(node.id, (indegrees.get(node.id) || 0) + 1);
      }
    }
  }

  return { indegrees, adjList };
}

function inferLinearDeps(nodes: WorkflowNode[]): void {
  for (let i = 1; i < nodes.length; i++) {
    nodes[i].dependsOn = [nodes[i - 1].id];
  }
  if (nodes.length > 0) {
    nodes[0].dependsOn = [];
  }
}

function hasExplicitDeps(nodes: WorkflowNode[]): boolean {
  return nodes.some((n) => n.dependsOn !== undefined);
}

function collectInput(
  nodeId: string,
  deps: string[] | undefined,
  outputs: Map<string, string>,
  prompt: string,
): string {
  if (!deps || deps.length === 0) return prompt;
  return deps
    .map((id) => outputs.get(id) || "")
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function findTerminalNodeIds(adjList: Map<string, string[]>): string[] {
  return Array.from(adjList.entries())
    .filter(([, deps]) => deps.length === 0)
    .map(([id]) => id);
}

export async function executeDag(
  workflow: Workflow,
  prompt: string,
  plugins: Map<string, AIPlugin>,
  callbacks?: DagCallbacks,
): Promise<DagResult> {
  const nodes = workflow.nodes.map((n) => ({ ...n }));
  const hadExplicitDeps = hasExplicitDeps(nodes);

  if (!hadExplicitDeps) {
    inferLinearDeps(nodes);
  }

  const { indegrees, adjList } = buildDepGraph(nodes);
  const outputs = new Map<string, string>();
  const allOutputs: DagNodeOutput[] = [];
  const trace: DagResult["executionTrace"] = [];

  const completed = new Set<string>();
  const failed = new Set<string>();
  let wave = 0;

  while (completed.size + failed.size < nodes.length) {
    wave++;

    const ready = nodes.filter(
      (n) =>
        !completed.has(n.id) &&
        !failed.has(n.id) &&
        (indegrees.get(n.id) || 0) === 0,
    );

    if (ready.length === 0) {
      const stuck = nodes
        .filter((n) => !completed.has(n.id) && !failed.has(n.id))
        .map((n) => n.id);
      return {
        success: false,
        nodeOutputs: allOutputs,
        executionTrace: trace,
        error: `DAG cycle detected: [${stuck.join(", ")}] cannot be resolved.`,
        failedNode: stuck[0],
      };
    }

    callbacks?.onWaveStart?.(wave, ready.map((n) => n.id));

    const settled = await Promise.allSettled(
      ready.map(async (node) => {
        const plugin =
          plugins.get(node.pluginId) ??
          (node.fallbackPluginId
            ? plugins.get(node.fallbackPluginId)
            : undefined);

        if (!plugin) {
          throw new Error(
            `No plugin for node "${node.id}" (pluginId: ${node.pluginId})`,
          );
        }

        const input = collectInput(
          node.id,
          node.dependsOn,
          outputs,
          prompt,
        );

        callbacks?.onNodeStart?.(node.id);
        const start = performance.now();

        try {
          const text = await plugin.execute(
            input,
            node.systemInstruction,
            node.modelId,
          );
          const duration = performance.now() - start;
          callbacks?.onNodeComplete?.(node.id, text, duration);
          return { nodeId: node.id, text, duration };
        } catch (err: any) {
          const duration = performance.now() - start;
          callbacks?.onNodeError?.(node.id, err);
          throw { nodeId: node.id, error: err, duration };
        }
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const node = ready[i];

      if (result.status === "fulfilled") {
        const { nodeId, text, duration } = result.value;
        outputs.set(nodeId, text);
        allOutputs.push({ nodeId, text, duration });
        trace.push({ wave, nodeId, duration });
        completed.add(nodeId);

        const downstream = adjList.get(nodeId) || [];
        for (const dep of downstream) {
          indegrees.set(dep, (indegrees.get(dep) || 1) - 1);
        }
      } else {
        failed.add(node.id);
        trace.push({ wave, nodeId: node.id, duration: 0 });
        return {
          success: false,
          nodeOutputs: allOutputs,
          executionTrace: trace,
          error: `Node "${node.id}" failed: ${result.reason}`,
          failedNode: node.id,
        };
      }
    }
  }

  const terminalIds = findTerminalNodeIds(adjList);
  const terminalOutputs = terminalIds
    .map((id) => outputs.get(id) || "")
    .filter(Boolean);

  let output: string | undefined;
  let warning: string | undefined;

  if (terminalOutputs.length === 0) {
    output = allOutputs.length > 0 ? allOutputs[allOutputs.length - 1].text : undefined;
  } else if (terminalOutputs.length === 1) {
    output = terminalOutputs[0];
  } else {
    output = terminalOutputs.join("\n\n");
    if (hadExplicitDeps) {
      const names = terminalIds.map((id) => `"${id}"`).join(", ");
      warning = `Workflow "${workflow.name}" has ${terminalIds.length} terminal nodes (${names}) but no merge node. Consider adding a merge node. Concatenating raw outputs.`;
    }
  }

  return {
    success: true,
    output,
    warning,
    nodeOutputs: allOutputs,
    executionTrace: trace,
  };
}
