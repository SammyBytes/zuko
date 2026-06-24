# Zuko

A minimalist, high-performance, and multi-model prompt orchestration pipeline designed for the terminal. Built on top of Bun and the Vercel AI SDK, Zuko allows developers to daisy-chain multiple Large Language Models (e.g., Gemini, Claude, Grok, Groq) sequentially to refine, audit, and generate optimal technical outputs without leaving their workspace.

## Core Objective

The primary goal of Zuko is to eliminate the friction of manual prompt engineering and iterative copy-pasting between different AI interfaces. By implementing a sequential node architecture with built-in fallback resilience, Zuko transforms raw, ambiguous ideas into production-ready code or precise technical specifications through a single terminal command.

## Ecosystem Architecture

Zuko utilizes a highly decoupled, modular monorepo structure. The core package handles purely the terminal user interface (TUI) and orchestration logic, while AI providers are loaded dynamically at runtime as lightweight plug-and-play packages.

## Local Development & Testing Guide

Since Zuko is currently in an alpha state and not available via standard global installation managers, developers can run and test the pipeline locally using Bun Workspaces.

### Prerequisites

* Bun runtime installed on your machine.
* Valid API keys for the providers you intend to test (e.g., Groq, Google Gemini).

### 1. Clone and Install Dependencies

Clone the repository and install the internal dependencies from the root of the monorrepo. This will automatically map the local workspaces.

```bash
git clone https://github.com/SammyBytes/zuko-monorepo.git
cd zuko-monorepo
bun install

```

### 2. Link Subpackages for Development

To enable the core package to resolve the dynamic plugin imports locally in your development environment, establish symbolic links between the packages.

```bash
# Link the plugin package globally to your local Bun cache
bun link --cwd packages/plugin-groq

# Register the link inside the core package
bun link @zuko/plugin-groq --cwd packages/zuko

```

### 3. Set Up Environment Variables

Export the required API keys to your current terminal session. For testing with the default free-tier plugin (Groq):

```bash
export GROQ_API_KEY="your_groq_api_key_here"

```

### 4. Run the Pipeline

Execute the core entry point directly using Bun:

```bash
bun packages/zuko/src/index.ts

```

## Project Status & Roadmap

* [x] Core Monorepo & Workspace Infrastructure with Bun.
* [x] Dynamic Lazy-Loading Plugin Architecture.
* [x] Sequential Pipeline Graph Execution.
* [ ] Interactive TUI Workflow Creator (via `@clack/prompts`).
* [ ] Portable File Persistence (`workflows.json`).
* [ ] Automated Fallback Node Execution.