export interface AIPlugin {
  id: AIPluginId;
  name: string;
  execute: (prompt: string, systemInstruction?: string) => Promise<string>;
}

export const AIPluginIds = {
  GROQ: "groq",
  GEMINI: "gemini",
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
} as const;

export type AIPluginId = (typeof AIPluginIds)[keyof typeof AIPluginIds];

export interface WorkflowNode {
  id: string; // Ej: "A", "B"
  pluginId: AIPluginId; // Ej: "groq", "gemini"
  systemInstruction?: string;
  fallbackPluginId: AIPluginId | null; // Ej: "groq", "gemini" o null
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
}
