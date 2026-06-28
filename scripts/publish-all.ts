#!/usr/bin/env bun
import { execSync } from "node:child_process";

const packages = ["packages/core", "packages/plugin-groq", "packages/zuko"];

for (const dir of packages) {
  console.log(`\nPublishing ${dir}...`);
  execSync("npm publish", {
    cwd: dir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_AUTH_TOKEN: process.env.NPM_TOKEN,
    },
  });
}

console.log("\nAll packages published.");
