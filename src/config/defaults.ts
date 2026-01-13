import type { Config, ToolConfig } from "./schema.js";

export const DEFAULT_TOOL_CONFIGS: Record<string, ToolConfig> = {
	"claude-code": {
		command: "claude",
		model: "anthropic/claude-sonnet-4-5",
		template: "claude --allowedTools Edit,Write,Bash,Read,Glob,Grep --print < {promptFile}",
	},
	opencode: {
		command: "opencode",
		model: "gpt-4o",
		template: "opencode --file {promptFile}",
	},
	cursor: {
		command: "cursor",
		model: "sonnet",
		template: "cursor agent --prompt-file {promptFile}",
	},
	codex: {
		command: "codex",
		model: "o3",
		template: "codex --prompt {promptFile}",
	},
};

export const DEFAULT_CONFIG: Config = {
	defaultTool: "claude-code",
	maxIterations: 10,
	tools: {},
	stopConditions: {
		maxIterations: true,
		doneFile: {
			enabled: false,
			path: "DONE.md",
		},
		outputPattern: {
			enabled: false,
			pattern: "## COMPLETE",
		},
		hook: {
			enabled: false,
		},
	},
	hooks: {
		preIteration: null,
		postIteration: null,
		onError: null,
		onComplete: null,
	},
	errorHandling: {
		strategy: "retry-once",
		maxRetries: 1,
	},
	git: {
		autoCommit: false,
		commitStrategy: "per-iteration",
		commitMessageTemplate: "rl: iteration {iteration} - {sessionName}",
	},
	session: {
		progressVerbosity: "standard",
	},
};

export function getToolConfig(config: Config, toolName: string): ToolConfig {
	const customConfig = config.tools[toolName as keyof typeof config.tools];
	const defaultConfig = DEFAULT_TOOL_CONFIGS[toolName];

	if (!defaultConfig) {
		throw new Error(`Unknown tool: ${toolName}`);
	}

	return {
		...defaultConfig,
		...customConfig,
	};
}
