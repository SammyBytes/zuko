import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { AIPlugin } from "@sammybits/zuko-core";

const groqClient = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "",
});

const GroqPlugin: AIPlugin = {
  id: "groq",
  name: "Groq Cloud",
  description: "Ultra-fast inference provider running open models",

  async execute(
    prompt: string,
    systemInstruction?: string,
    modelId?: string,
  ): Promise<string> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set.");
    }

    const { text } = await generateText({
      model: groqClient(modelId || "llama-3.3-70b-versatile"),
      prompt,
      system: systemInstruction,
    });

    return text;
  },
};

export default GroqPlugin;
