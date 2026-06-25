export const AIPluginIds = {
  GROQ: "groq",
  GEMINI: "gemini",
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
} as const;

export type AIPluginId = (typeof AIPluginIds)[keyof typeof AIPluginIds];

export interface AIModelInfo {
  id: string; // Real model identifier (e.g., "llama-3.3-70b-versatile")
  name: string; // Readable name (e.g., "Llama 3.3 70B")
  description?: string;
}

export interface AIPlugin {
  id: AIPluginId;
  name: string;
  description?: string;
  models: AIModelInfo[];
  defaultModelId: string; // Fallback model if none is specified
  execute: (
    prompt: string,
    systemInstruction?: string,
    modelId?: string // Dynamic model selection per node
  ) => Promise<string>;
}

export interface WorkflowNode {
  id: string; // Unique step identifier (e.g., "user-story-splitter")
  pluginId: AIPluginId;
  modelId?: string; // Specific model chosen for this node execution
  systemInstruction?: string;
  fallbackPluginId: AIPluginId | null;
  fallbackModelId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
}