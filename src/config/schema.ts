import { z } from "zod";

export const ToolConfigSchema = z.object({
	command: z.string(),
	model: z.string().optional(),
	template: z.string(),
});

export const StopConditionsSchema = z.object({
	maxIterations: z.boolean().default(true),
	outputPattern: z
		.object({
			enabled: z.boolean().default(false),
			pattern: z.string().default("## COMPLETE"),
		})
		.default({}),
	hook: z
		.object({
			enabled: z.boolean().default(false),
			command: z.string().optional(),
		})
		.default({}),
});

export const HooksSchema = z.object({
	preIteration: z.string().nullable().default(null),
	postIteration: z.string().nullable().default(null),
	onError: z.string().nullable().default(null),
	onComplete: z.string().nullable().default(null),
});

export const ErrorHandlingSchema = z.object({
	strategy: z.enum(["stop", "retry-once", "continue"]).default("retry-once"),
	maxRetries: z.number().int().min(0).max(10).default(1),
});

export const GitConfigSchema = z.object({
	autoCommit: z.boolean().default(false),
	commitStrategy: z.enum(["per-iteration", "on-stop"]).default("per-iteration"),
	commitMessageTemplate: z.string().default("chore(rl): iteration {iteration} - {sessionName}"),
});

export const SessionConfigSchema = z.object({
	progressVerbosity: z.enum(["minimal", "standard", "full"]).default("standard"),
});

export const ModelDefinitionSchema = z.object({
	id: z.string(),
	provider: z.enum(["anthropic", "openai", "google", "cursor", "other"]).default("other"),
});

export const ConfigSchema = z.object({
	defaultTool: z.enum(["claude-code", "opencode", "cursor", "codex"]).default("claude-code"),
	defaultModel: z.string().optional(),
	maxIterations: z.number().int().min(1).max(1000).default(10),
	tools: z
		.object({
			"claude-code": ToolConfigSchema.optional(),
			opencode: ToolConfigSchema.optional(),
			cursor: ToolConfigSchema.optional(),
			codex: ToolConfigSchema.optional(),
		})
		.default({}),
	stopConditions: StopConditionsSchema.default({}),
	hooks: HooksSchema.default({}),
	errorHandling: ErrorHandlingSchema.default({}),
	git: GitConfigSchema.default({}),
	session: SessionConfigSchema.default({}),
	models: z.record(z.string(), ModelDefinitionSchema).default({}),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type StopConditions = z.infer<typeof StopConditionsSchema>;
export type Hooks = z.infer<typeof HooksSchema>;
export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;
export type GitConfig = z.infer<typeof GitConfigSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export type ToolName = "claude-code" | "opencode" | "cursor" | "codex";
