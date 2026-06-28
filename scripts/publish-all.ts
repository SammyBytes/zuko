#!/usr/bin/env bun
import { execSync } from "node:child_process";

const packages = ["packages/core", "packages/plugin-groq", "packages/zuko"];

for (const dir of packages) {
  console.log(`\nPublishing ${dir}...`);
  try {
    execSync("npm publish", {
      cwd: dir,
      stdio: "inherit",
      env: process.env
    });
  } catch (error) {
    console.error(`Failed to publish ${dir}`);
    process.exit(1);
  }
}

console.log("\nAll packages published successfully! ");