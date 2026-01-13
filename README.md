# ralphlike

A CLI tool that implements the [Ralph method](https://ghuntley.com/ralph/) - an iterative loop that feeds prompt files to AI coding agents.

## Installation

```bash
npm install -g ralphlike
```

## Quick Start

```bash
# Run a prompt file with default settings (10 iterations, claude-code)
rl prompt.md

# Run with specific iteration count
rl prompt.md -mi 5

# Use a different AI tool
rl prompt.md -t opencode
rl prompt.md -t cursor
rl prompt.md -t codex

# Preview without executing
rl prompt.md --dry-run

# Initialize project config
rl init
```

## How It Works

The Ralph method is a simple but powerful technique:

1. Write a prompt file describing what you want to build
2. Run `rl prompt.md -mi 10` to execute 10 iterations
3. Each iteration pipes your prompt to an AI coding agent
4. The agent makes changes, then the loop repeats
5. Stop conditions (max iterations, done file, pattern match) end the loop

Each session creates a `.ralph/{session}/` folder with:
- `prompt.md` - Copy of your original prompt
- `progress.md` - Log of each iteration with timestamps and durations
- `checklist.md` - Tasks extracted from your prompt as checkboxes

## CLI Reference

### Main Command

```bash
rl <prompt-file> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-mi, --max-iterations <n>` | Maximum loop iterations | 10 |
| `-t, --tool <tool>` | AI tool (claude-code, opencode, cursor, codex) | claude-code |
| `-m, --model <model>` | Model override | tool default |
| `-n, --name <name>` | Session name | from filename |
| `-c, --config <path>` | Config file path | ./rl.config.json |
| `--no-commit` | Disable auto-commit | - |
| `--dry-run` | Preview without executing | - |
| `-v, --verbose` | Verbose output | - |

### Initialize Config

```bash
rl init
```

Creates `rl.config.json` with interactive prompts for:
- Default AI tool
- Max iterations
- Stop conditions
- Auto-commit settings
- Error handling strategy

## Configuration

### rl.config.json

```json
{
  "defaultTool": "claude-code",
  "maxIterations": 10,

  "tools": {
    "claude-code": {
      "command": "claude",
      "model": "claude-sonnet-4-20250514",
      "template": "cat {promptFile} | claude"
    },
    "opencode": {
      "command": "opencode",
      "model": "gpt-4o",
      "template": "opencode --file {promptFile}"
    }
  },

  "stopConditions": {
    "maxIterations": true,
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
  }
}
```

### Stop Conditions

Stop conditions are evaluated in order after each iteration:

1. **maxIterations** - Always checked first (hard limit)
2. **outputPattern** - Stop when agent output matches regex
3. **hook** - Stop when custom script returns exit code 0

### Lifecycle Hooks

Hooks receive context via environment variables:

```bash
RL_ITERATION=3
RL_SESSION_NAME=auth
RL_PROMPT_FILE=/path/to/prompt.md
RL_SESSION_DIR=/path/to/.ralph/auth
RL_EXIT_CODE=0
RL_TOOL=claude-code
RL_MODEL=claude-sonnet-4-20250514
```

### Error Handling Strategies

| Strategy | Behavior |
|----------|----------|
| `stop` | Halt immediately on non-zero exit |
| `retry-once` | Retry failed iteration once, then stop (default) |
| `continue` | Log error, continue to next iteration |

### Git Integration

Enable auto-commit in config or use `rl init`:

```json
{
  "git": {
    "autoCommit": true,
    "commitStrategy": "per-iteration",
    "commitMessageTemplate": "rl: iteration {iteration} - {sessionName}"
  }
}
```

Strategies:
- `per-iteration` - Commit after each iteration
- `on-stop` - Single commit when session ends

Disable for a single run with `--no-commit`.

## Supported Tools

| Tool | Command | Notes |
|------|---------|-------|
| claude-code | `claude` | Anthropic's Claude Code CLI |
| opencode | `opencode` | OpenCode CLI |
| cursor | `cursor` | Cursor editor CLI |
| codex | `codex` | OpenAI Codex CLI |

Custom tool templates can be configured in `rl.config.json`.

## Example Workflow

1. Create a prompt file:

```markdown
# Build Authentication

Create a user authentication system with:

- [ ] User model with email/password
- [ ] Login endpoint
- [ ] JWT token generation
- [ ] Password hashing with bcrypt
- [ ] Protected route middleware
```

2. Run the loop:

```bash
rl prompt-auth.md -mi 10 -t claude-code
```

3. Monitor progress in `.ralph/auth/progress.md`

4. The loop stops when:
   - Max iterations reached
   - The agent outputs a completion pattern

## Tips

- **Start small**: Begin with 3-5 iterations to tune your prompt
- **Be specific**: Detailed prompts produce better results
- **Use checkboxes**: Tasks in markdown checkboxes are tracked in checklist.md
- **Review progress**: Check `.ralph/{session}/progress.md` after runs

## License

MIT
