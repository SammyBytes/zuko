import { exec } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";

export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd =
      process.platform === "darwin"
        ? "pbcopy"
        : "xclip -selection clipboard 2>/dev/null || xsel --clipboard --input 2>/dev/null";

    const child = exec(cmd, (err) => resolve(!err));
    child.stdin?.write(text);
    child.stdin?.end();
  });
}

export async function showOutput(result: string) {
  const width = Math.min(process.stdout.columns ?? 80, 80);
  const divider = pc.gray("─".repeat(width));

  p.log.message(`\n${divider}`);
  p.log.message(result);
  p.log.message(divider);

  const copied = await copyToClipboard(result);

  if (copied) {
    p.log.message(pc.gray("  ✓ Full pipeline output copied to clipboard"));
  }
}
