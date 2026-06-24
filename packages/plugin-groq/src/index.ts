import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { AIPlugin } from '../../zuko/src/types';

const groqClient = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

const GroqPlugin: AIPlugin = {
  id: 'groq',
  name: 'Groq (Llama 3)',
  
  async execute(prompt: string, systemInstruction?: string): Promise<string> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set. Please set it to your Groq API key.");
    }

    const { text } = await generateText({
      model: groqClient('llama3-70b-8192'),
      prompt: prompt,
      system: systemInstruction,
    });

    return text;
  }
};

export default GroqPlugin;