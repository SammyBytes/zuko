#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { name, version } = JSON.parse(readFileSync("./package.json", "utf-8"));

const published = getPublishedVersions(name);

if (published.includes(version)) {
  console.error(`❌ ${name}@${version} is already published on npm`);
  process.exit(1);
}

console.log(`✅ ${name}@${version} — safe to publish`);

function getPublishedVersions(pkg: string): string[] {
  try {
    const output = execSync(`npm view ${pkg} versions --json 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 15000,
      stdio: "pipe",
    });
    return JSON.parse(output.trim());
  } catch {
    return [];
  }
}
