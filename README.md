# Zuko

Chain AI models into prompt pipelines — right from your terminal.

Zuko lets you build workflows where each step sends its output to the next, using different providers (Groq, Gemini, etc.). Create a linear chain or a parallel DAG, run it, and copy the result — all without leaving the command line.

> **Note:** This is a hobby project. It works, but expect rough edges. Contributions and feedback are welcome.

## Install

```bash
npm install -g @sammybits/zuko-cli
```

Or with Bun:

```bash
bun install -g @sammybits/zuko-cli
```

### Requirements

- [Bun](https://bun.sh) or [Node.js](https://nodejs.org) 18+
- An API key for at least one AI provider

## Quick Start

```bash
# 1. Launch Zuko — it will ask for API keys on first run
zuko
```

From the menu:
1. **Create** — pick a template or build a custom workflow
2. **Run** — select a workflow and execute it
3. **Edit** — modify an existing workflow's nodes or dependencies
4. **Config** — manage your API keys

On first launch, Zuko will detect missing API keys and walk you
through setting them up. Keys are saved to a config file so you
only need to do this once.

## CLI Reference

| Command | What it does |
|---|---|---|
| `zuko` | Launch the interactive terminal UI |
| `zuko create` | Create a workflow (interactive wizard) |
| `zuko run <workflow-id>` | Run a workflow by ID |
| `zuko edit [workflow-id]` | Edit an existing workflow |
| `zuko config list` | List configured API keys |
| `zuko config set <ENV_VAR> --key <value>` | Save an API key |
| `zuko config unset <ENV_VAR>` | Remove an API key |
| `zuko --help` | Show all options |

### Examples

```bash
# Open the TUI menu
zuko

# Run a workflow directly
zuko run my-pipeline

# Edit a workflow
zuko edit my-pipeline
```

## Workflows

A workflow is a series of AI nodes connected in a directed acyclic graph (DAG).

### Linear chain

Nodes run one after another. Each node receives the previous node's output as its prompt.

```
Prompt → Researcher → Writer → Publisher
```

### Parallel DAG

Independent nodes run at the same time. A node can depend on multiple upstream nodes.

```
         ┌─ Security Scan ─┐
Prompt → ┤                 ├─ Report
         └─ Performance ───┘
```

### Node properties

Each node has:

- **Plugin** — which AI provider to use
- **System instruction** — context for the AI (e.g., "You are a code reviewer")
- **Model ID** — which model to use (provider-dependent)
- **Dependencies** — which nodes must complete first
- **Fallback plugin** — optional backup if the primary fails

Workflows are saved as JSON files in `.zuko/workflows/` and can be shared or version-controlled.

## Plugins (AI providers)

Plugins are npm packages that add support for different AI providers.

```bash
npm install @sammybits/zuko-plugin-groq
```

That's it — Zuko discovers plugins automatically. No config files to edit.

Available plugins:

| Package | Provider | API key |
|---|---|---|
| `@sammybits/zuko-plugin-groq` | Groq | `GROQ_API_KEY` |

## Configuration

API keys are stored in a config file — no need to export them every
session.

| OS | Config file location |
|---|---|
| Linux | `~/.config/zuko/config.json` |
| Windows | `%APPDATA%/zuko/config.json` |

### Quick setup

```bash
zuko config set GROQ_API_KEY --key gsk_your_key_here
```

### View configured keys

```bash
zuko config list
# GROQ_API_KEY=gsk****_here
```

### Environment variables (fallback)

If an environment variable is set (e.g. `export GROQ_API_KEY=...`),
it takes precedence over the config file. This is useful for
temporary overrides or CI environments.

| Variable | Required for | Description |
|---|---|---|
| `GROQ_API_KEY` | Groq plugin | API key from console.groq.com |
| `ZUKO_DEBUG=1` | — | Enable debug output |

## Need help?

- Open an issue on [GitHub](https://github.com/SammyBytes/zuko/issues)
- For contributing or building from source: see [CONTRIBUTING.md](./CONTRIBUTING.md)
