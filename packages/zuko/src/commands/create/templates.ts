export interface TemplateNode {
  name: string;
  pluginId: string;
  systemInstruction: string;
  modelId?: string;
  dependsOn?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: TemplateNode[];
}

export const templates: WorkflowTemplate[] = [
  {
    id: "quick-prompt",
    name: "Quick Prompt",
    description: "Single node — write a prompt, get an answer. No config needed.",
    nodes: [
      {
        name: "Response",
        pluginId: "groq",
        systemInstruction: "",
        dependsOn: [],
      },
    ],
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Write code, then an AI reviewer audits it. 2 nodes in a chain.",
    nodes: [
      {
        name: "Generator",
        pluginId: "groq",
        systemInstruction:
          "You are a senior software engineer. Write clean, well-documented code based on the requirement.",
        dependsOn: [],
      },
      {
        name: "Reviewer",
        pluginId: "groq",
        systemInstruction:
          "You are a code reviewer. Review the code for bugs, security issues, and style. Provide actionable feedback.",
        dependsOn: ["Generator"],
      },
    ],
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description:
      "Analyze code in parallel for security vulnerabilities and performance issues. 3 nodes with DAG.",
    nodes: [
      {
        name: "Analyzer",
        pluginId: "groq",
        systemInstruction:
          "Analyze the following codebase and extract key architectural details.",
        dependsOn: [],
      },
      {
        name: "Security Scan",
        pluginId: "groq",
        systemInstruction:
          "You are a security auditor. Find vulnerabilities, hardcoded secrets, and injection risks.",
        dependsOn: ["Analyzer"],
      },
      {
        name: "Performance Audit",
        pluginId: "groq",
        systemInstruction:
          "You are a performance engineer. Identify bottlenecks, n+1 queries, and optimisation opportunities.",
        dependsOn: ["Analyzer"],
      },
    ],
  },
];
