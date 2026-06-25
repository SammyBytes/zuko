import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { AIPlugin, AIModelInfo } from '../../zuko/src/types';

// Initialize Groq provider client using OpenAI compatibility layer
const groqClient = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

// Supported models available via Groq Cloud
const GROQ_MODELS: AIModelInfo[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)' },
  { id: 'llama3-8b-8192', name: 'Llama 3 8B (Fast)' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
];

const GroqPlugin: AIPlugin = {
  id: 'groq',
  name: 'Groq Cloud',
  description: 'Ultra-fast inference provider running open models',
  models: GROQ_MODELS,
  defaultModelId: 'llama-3.3-70b-versatile',
  
  async execute(prompt: string, systemInstruction?: string, modelId?: string): Promise<string> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set.");
    }

    // Resolve active model: use specified node model or fall back to default
    const activeModel = modelId && this.models.some(m => m.id === modelId)
      ? modelId
      : this.defaultModelId;

    const { text } = await generateText({
      model: groqClient(activeModel),
      prompt: prompt,
      system: systemInstruction,
    });

    return text;
  }
};

export default GroqPlugin;