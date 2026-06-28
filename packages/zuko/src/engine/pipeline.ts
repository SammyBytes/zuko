import type { AIPlugin, Workflow } from "@sammybits/zuko-core";

export interface PipelineResult {
  success: boolean;
  output?: string;
  nodeOutputs: Array<{ nodeId: string; text: string }>;
  error?: string;
  failedNode?: string;
}

export async function executePipeline(
  workflow: Workflow,
  prompt: string,
  plugins: Map<string, AIPlugin>,
): Promise<PipelineResult> {
  let currentInput = prompt;
  const nodeOutputs: Array<{ nodeId: string; text: string }> = [];

  for (const node of workflow.nodes) {
    const plugin =
      plugins.get(node.pluginId) ??
      (node.fallbackPluginId ? plugins.get(node.fallbackPluginId) : undefined);

    if (!plugin) {
      return {
        success: false,
        error: `No plugin found for node "${node.id}" (pluginId: ${node.pluginId})`,
        nodeOutputs,
        failedNode: node.id,
      };
    }

    try {
      const text = await plugin.execute(
        currentInput,
        node.systemInstruction,
        node.modelId,
      );

      nodeOutputs.push({ nodeId: node.id, text });
      currentInput = text;
    } catch (err: any) {
      return {
        success: false,
        error: `Node "${node.id}" failed: ${err.message}`,
        nodeOutputs,
        failedNode: node.id,
      };
    }
  }

  return {
    success: true,
    output: nodeOutputs
      .map((n) => `## [Node: ${n.nodeId}]\n\n${n.text}`)
      .join("\n\n---\n\n"),
    nodeOutputs,
  };
}
