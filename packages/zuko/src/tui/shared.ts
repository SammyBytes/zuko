import { exec } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";

function tryCopy(text: string, cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = exec(cmd, { timeout: 1500 }, (err) => resolve(!err));
    child.stdin?.write(text);
    child.stdin?.end();
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (process.platform === "darwin") {
    return tryCopy(text, "pbcopy");
  }

  const results = await Promise.allSettled([
    tryCopy(text, "xclip -selection clipboard"),
    tryCopy(text, "xsel --clipboard --input"),
    tryCopy(text, "wl-copy"),
  ]);

  return results.some((r) => r.status === "fulfilled" && r.value);
}

export function showOutput(result: string): void {
  const width = Math.min(process.stdout.columns ?? 80, 80);
  const divider = pc.gray("─".repeat(width));

  p.log.message(`\n${divider}`);
  p.log.message(result);
  p.log.message(divider);
}
