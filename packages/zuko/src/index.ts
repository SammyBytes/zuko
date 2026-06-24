import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadPlugins } from './registry';
import type { Workflow } from './types';

async function main() {
  console.clear();
  
  p.intro(`${pc.bgRed(pc.black(' ZUKO '))} ${pc.bold('- Multi-Model Prompt Pipeline')}`);

  const loaderPlugins = p.spinner();
  loaderPlugins.start('Loading available AI plugins...');
  const pluginsDisponibles = await loadPlugins();
  loaderPlugins.stop(`Ecosystem ready: ${pluginsDisponibles.size} plugins detected.`);

  if (pluginsDisponibles.size === 0) {
    p.note(
      `No AI plugins found.\nInstall one by running: ${pc.cyan('bun install')}`,
      'Alert'
    );
  }

 // TODO: Load from workflow JSON file
  const workflowPrueba: Workflow = {
    id: 'poc-flow',
    name: 'Test Pipeline with Groq',
    description: 'Single-node pipeline using Groq as a free trial',
    nodes: [
      {
        id: 'Engineer',
        pluginId: 'groq',
        systemInstruction: 'You are a prompt engineer. Refine the user\'s prompt to make it more effective and clear, while preserving the original intent.',
        fallbackPluginId: null // No fallback plan for now
      },
      {
        id: 'QualityCheck',
        pluginId: 'groq',
        systemInstruction: 'Quality check the refined prompt and provide suggestions for improvement, ensuring it is concise and unambiguous.',
        fallbackPluginId: null // No fallback plan for now
      }
    ]
  };

  const promptUser = await p.text({
    message: 'Enter your base prompt or code to refine:',
    placeholder: 'Type here...',
    validate(value) {
      if (value.length === 0) return 'The prompt cannot be empty.';
    },
  });

  if (p.isCancel(promptUser)) {
    p.cancel('Operation cancelled safely.');
    process.exit(0);
  }

  // 4. Orchestration of the Graph
  let currentResult = promptUser;
  p.note(`Starting workflow execution: ${pc.green(workflowPrueba.name)}`);

  for (const node of workflowPrueba.nodes) {
    const plugin = pluginsDisponibles.get(node.pluginId);
    if (!plugin) {
      p.log.warn(`Skipping node ${node.id}: The plugin '${node.pluginId}' is not installed in the system.`);
      continue;
    }

    const s = p.spinner();
    s.start(`Node ${node.id} -> Processing with ${pc.cyan(plugin.name)}...`);
    
    try {
      // Pass the accumulated result to the corresponding plugin
      currentResult = await plugin.execute(currentResult, node.systemInstruction);
      s.stop(`Node ${node.id} completed.`);
    } catch (error: any) {
      s.stop(`Error in node ${node.id}`);
      p.cancel(`The workflow was interrupted due to an error: ${error.message}`);
      process.exit(1);
    }
  }

  // 5. Print the final polished output of the entire pipeline
  p.outro(`${pc.bgGreen(pc.black(' FINAL RESULT '))} \n\n${currentResult}\n`);
}

main().catch((err) => {
  p.log.error(`Critical error during execution: ${err.message}`);
  process.exit(1);
});