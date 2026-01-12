# ralphlike - AI Coding Loop CLI Tool

## Overview

A TypeScript CLI tool (`rl`) that implements the "Ralph method" - an iterative loop that feeds prompt files to AI coding agents (claude-code, opencode, cursor cli, codex) with configurable stopping conditions, progress tracking, and lifecycle hooks.

## Core Architecture

```
ralphlike/
├── src/
│   ├── cli.ts              # Main CLI entry point (commander.js)
│   ├── config/
│   │   ├── loader.ts       # Config file loading & merging
│   │   ├── schema.ts       # Zod schema for rl.config.json
│   │   └── defaults.ts     # Default configuration values
│   ├── tools/
│   │   ├── adapter.ts      # Base adapter interface
│   │   ├── claude-code.ts  # Claude Code implementation
│   │   ├── opencode.ts     # OpenCode implementation
│   │   ├── cursor.ts       # Cursor CLI implementation
│   │   └── codex.ts        # Codex implementation
│   ├── loop/
│   │   ├── runner.ts       # Main loop orchestrator
│   │   ├── hooks.ts        # Lifecycle hook executor
│   │   └── stop.ts         # Stop condition evaluators
│   ├── session/
│   │   ├── manager.ts      # .ralph folder & session management
│   │   └── progress.ts     # progress.md writer
│   ├── git/
│   │   └── commits.ts      # Auto-commit functionality
│   └── utils/
│       └── prompt.ts       # Prompt file parsing & checkbox tracking
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

## CLI Interface

### Commands

```bash
# Run a session (main command)
rl <prompt-file> [options]
rl prompt.md -mi 10
rl feature-auth.md -mi 5 --tool claude-code --model claude-sonnet-4-20250514

# Initialize config
rl init                    # Creates rl.config.json with interactive prompts

# Help
rl --help
rl <command> --help
```

### Options

| Flag | Long | Description | Default |
|------|------|-------------|---------|
| `-mi` | `--max-iterations` | Maximum loop iterations | 10 |
| `-t` | `--tool` | AI tool to use | from config or "claude-code" |
| `-m` | `--model` | Model override | from tool config |
| `-n` | `--name` | Session/feature name | derived from prompt filename |
| `-c` | `--config` | Config file path | ./rl.config.json |
| `--no-commit` | | Disable auto-commit | from config |
| `--dry-run` | | Show what would run without executing | false |
| `-v` | `--verbose` | Verbose output | false |

## Configuration Schema (rl.config.json)

```json
{
  "defaultTool": "claude-code",
  "maxIterations": 10,

  "tools": {
    "claude-code": {
      "command": "claude",
      "promptFlag": "--prompt",
      "model": "claude-sonnet-4-20250514",
      "template": "cat {promptFile} | claude"
    },
    "opencode": {
      "command": "opencode",
      "model": "gpt-4o",
      "template": "opencode --file {promptFile}"
    },
    "cursor": {
      "command": "cursor",
      "model": "claude-sonnet-4-20250514",
      "template": "cursor agent --prompt-file {promptFile}"
    },
    "codex": {
      "command": "codex",
      "model": "o3",
      "template": "codex --prompt {promptFile}"
    }
  },

  "stopConditions": {
    "maxIterations": true,
    "doneFile": {
      "enabled": false,
      "path": "DONE.md"
    },
    "outputPattern": {
      "enabled": false,
      "pattern": "## COMPLETE"
    },
    "hook": {
      "enabled": false,
      "command": "./scripts/check-done.sh"
    }
  },

  "hooks": {
    "preIteration": null,
    "postIteration": null,
    "onError": null,
    "onComplete": null
  },

  "errorHandling": {
    "strategy": "retry-once",
    "maxRetries": 1
  },

  "git": {
    "autoCommit": false,
    "commitStrategy": "per-iteration",
    "commitMessageTemplate": "rl: iteration {iteration} - {sessionName}"
  },

  "session": {
    "progressVerbosity": "standard"
  }
}
```

## Session Management (.ralph folder)

### Folder Structure

```
.ralph/
├── auth/                           # From prompt-auth.md
│   ├── prompt.md                   # Copy of original prompt
│   ├── progress.md                 # Session progress log
│   └── checklist.md                # Parsed tasks with checkboxes
├── session-20250112-1430/          # When prompt is generic (prompt.md)
│   ├── prompt.md
│   ├── progress.md
│   └── checklist.md
```

### Session Naming Logic

1. Extract name from prompt filename: `feature-auth.md` → `auth`
2. If filename is generic (`prompt.md`, `plan.md`, `PROMPT.md`): prompt user interactively
3. CLI `--name` flag overrides all

### progress.md Format

```markdown
# Session: auth
Started: 2025-01-12 14:30:00
Tool: claude-code
Model: claude-sonnet-4-20250514
Max Iterations: 10

## Iteration 1 - 14:30:15
- Status: completed
- Duration: 45s
- Files changed: 3
- Git diff summary: +120 -15 lines

## Iteration 2 - 14:31:00
- Status: completed
- Duration: 38s
- Files changed: 2
- Git diff summary: +45 -8 lines

## Summary
Total iterations: 5
Stop reason: done-file detected
Duration: 4m 30s
```

### checklist.md (Parsed from prompt)

```markdown
# Tasks from prompt-auth.md

- [x] Create user model
- [x] Add authentication middleware
- [ ] Implement JWT tokens
- [ ] Add password hashing
```

Tasks are marked complete based on iteration progress (configurable detection).

## Tool Adapters

### Interface

```typescript
interface ToolAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  buildCommand(promptFile: string, model?: string): string;
  execute(command: string): Promise<ExecutionResult>;
  parseOutput(output: string): ParsedOutput;
}

interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}
```

### Tool Command Templates

| Tool | Default Template |
|------|------------------|
| claude-code | `cat {promptFile} \| claude` |
| opencode | `opencode --file {promptFile}` |
| cursor | `cursor agent --prompt-file {promptFile}` |
| codex | `codex --prompt {promptFile}` |

## Stop Conditions

Evaluated in order after each iteration:

1. **Max iterations** (always checked first) - hard limit
2. **Done file** - checks for existence of configured file (e.g., `DONE.md`)
3. **Output pattern** - regex match against agent output
4. **Hook script** - runs command, stops if exit code is 0

## Lifecycle Hooks

```bash
# Hook environment variables available:
RL_ITERATION=3
RL_SESSION_NAME=auth
RL_PROMPT_FILE=/path/to/prompt.md
RL_SESSION_DIR=/path/to/.ralph/auth
RL_EXIT_CODE=0  # (for onError/postIteration)
```

Hooks are shell commands that receive context via environment variables.

## Error Handling

| Strategy | Behavior |
|----------|----------|
| `stop` | Halt immediately on non-zero exit |
| `retry-once` | Retry failed iteration once, then stop (default) |
| `continue` | Log error, continue to next iteration |

## Implementation Plan

### Phase 1: Project Setup
- [x] Initialize npm package with TypeScript
- [x] Configure biome.json for linting/formatting
- [x] Configure tsconfig.json for Node.js CLI
- [x] Set up package.json with bin entry for "rl"
- [x] Add build scripts and npm publish config

### Phase 2: Core CLI & Config
- [x] Implement CLI with commander.js
- [x] Create config schema with Zod
- [x] Implement config loader (file + CLI args merge)
- [x] Add `rl init` command with interactive prompts
- [x] Implement `--help` for all commands/options

### Phase 3: Tool Adapters
- [x] Create base adapter interface
- [x] Implement claude-code adapter
- [x] Implement opencode adapter
- [x] Implement cursor adapter
- [x] Implement codex adapter
- [x] Add tool availability detection

### Phase 4: Loop Engine
- [x] Implement main loop runner
- [x] Add stop condition evaluators
- [x] Implement lifecycle hook execution
- [x] Add error handling with retry logic

### Phase 5: Session Management
- [x] Create .ralph folder structure
- [x] Implement session naming logic
- [x] Build progress.md writer
- [x] Add checklist.md generation from prompt
- [x] Implement checkbox progress tracking

### Phase 6: Git Integration
- [x] Implement auto-commit functionality
- [x] Support per-iteration and on-stop strategies
- [x] Add commit message templates

### Phase 7: Polish & Publish
- [x] Add comprehensive --help text
- [x] Write README.md with examples
- [x] Test npm publish flow
- [x] Add GitHub Actions for CI/publish

## Key Files to Create

1. `package.json` - npm config with bin, scripts, dependencies
2. `tsconfig.json` - TypeScript config for Node.js
3. `biome.json` - Linting and formatting rules
4. `src/cli.ts` - Main entry point
5. `src/config/schema.ts` - Zod validation schema
6. `src/loop/runner.ts` - Core loop logic
7. `src/tools/adapter.ts` - Tool adapter interface

## Dependencies

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "zod": "^3.23.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "inquirer": "^9.0.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0"
  }
}
```

## Verification

After implementation, verify by:

1. `npm install -g .` (local install)
2. `rl --help` - should show all options
3. `rl init` - should create rl.config.json
4. `rl test-prompt.md -mi 2 --dry-run` - should show planned execution
5. `rl test-prompt.md -mi 2` - should run 2 iterations with claude-code
6. Check `.ralph/` folder structure and progress.md content
7. `npm publish --dry-run` - verify publish config
