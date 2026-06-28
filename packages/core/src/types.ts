export interface AIPlugin {
  id: string;
  name: string;
  description?: string;
  execute: (
    prompt: string,
    systemInstruction?: string,
    modelId?: string,
  ) => Promise<string>;
}

export interface WorkflowNode {
  id: string;
  pluginId: string;
  modelId?: string;
  systemInstruction?: string;
  fallbackPluginId: string | null;
  fallbackModelId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
}

export interface CommandContext {
  plugins: Map<string, AIPlugin>;
}

export interface ZukoCommand<TResult = any> {
  name: string;
  description: string;
  arguments?: { name: string; required?: boolean; description?: string }[];
  options?: { flags: string; description: string }[];
  execute: (args: Record<string, any>, context: CommandContext) => Promise<TResult>;
}
