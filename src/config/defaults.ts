import type { Config, ToolConfig } from "./schema.js";
import { type ModelDefinition, resolveModel } from "./models.js";

// Model format by tool:
// - opencode: uses "provider/modelId" format (e.g., "openai/gpt-4o")
// - claude-code, cursor, codex: use just the model id (e.g., "claude-sonnet-4-5")

export const DEFAULT_TOOL_CONFIGS: Record<string, ToolConfig> = {
	"claude-code": {
		command: "claude",
		model: "claude-sonnet-4.5",
		template: "claude --model {model} --allowedTools Edit,Write,Bash,Read,Glob,Grep --print < {promptFile}",
	},
	opencode: {
		command: "opencode",
		model: "gemini-3-flash",
		// opencode uses provider/modelId format - handled by formatModelForTool()
		template: "opencode run --model {model} < {promptFile}",
	},
	cursor: {
		command: "agent",
		model: "composer-1",
		template: "agent -f --model {model} -p \"$(cat {promptFile})\"",
	},
	codex: {
		command: "codex",
		model: "gpt-5.1-codex-mini",
		template: "codex -m {model} exec --skip-git-repo-check --full-auto \"$(cat {promptFile})\"",
	},
};

export const DEFAULT_CONFIG: Config = {
	defaultTool: "claude-code",
	maxIterations: 10,
	tools: {},
	stopConditions: {
		maxIterations: true,
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
	models: {},
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

/**
 * Formats a model name for a specific tool
 * - opencode: uses "provider/modelId" format (e.g., "openai/gpt-4o")
 * - others: use just the model id (e.g., "claude-sonnet-4-5")
 */
export function formatModelForTool(
	modelName: string,
	toolName: string,
	customModels?: Record<string, ModelDefinition>,
): string {
	const model = resolveModel(modelName, customModels);

	if (!model) {
		// If model not found in registry, use as-is
		return modelName;
	}

	if (toolName === "opencode") {
		// opencode uses provider/modelId format
		return `${model.provider}/${model.id}`;
	}

	// All other tools use just the model id
	return model.id;
}
