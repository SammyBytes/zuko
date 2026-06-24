import type { AIPlugin } from './types';

const PLUGINS_SUPPORTED = [
  { id: 'groq', npmPackage: '@zuko/plugin-groq' },
  { id: 'gemini', npmPackage: '@zuko/plugin-gemini' },
  { id: 'claude', npmPackage: '@zuko/plugin-claude' }
];

export async function loadPlugins(): Promise<Map<string, AIPlugin>> {
  const plugins = new Map<string, AIPlugin>();

  for (const item of PLUGINS_SUPPORTED) {
    try {
      const modulo = await import(item.npmPackage);
      const plugin: AIPlugin = modulo.default;
      plugins.set(item.id, plugin);
    } catch {
    }
  }

  return plugins;
}