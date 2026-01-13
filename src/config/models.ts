export interface ModelDefinition {
	id: string;
	provider: "anthropic" | "openai" | "google" | "cursor" | "other";
}

export const DEFAULT_MODELS: Record<string, ModelDefinition> = {
	// Anthropic models (2025)
	"claude-opus-4.5": { id: "claude-opus-4-5", provider: "anthropic" },
	"claude-sonnet-4.5": { id: "claude-sonnet-4-5", provider: "anthropic" },
	"claude-haiku-4.5": { id: "claude-haiku-4-5", provider: "anthropic" },

	// OpenAI models (2025)
	"gpt-5.2": { id: "gpt-5.2", provider: "openai" },
	"gpt-5.2-codex": { id: "gpt-5.2-codex", provider: "openai" },
	"gpt-5.1-codex-max": { id: "gpt-5.1-codex-max", provider: "openai" },
	"gpt-5.1-codex": { id: "gpt-5.1-codex", provider: "openai" },
	"gpt-5.1-codex-mini": { id: "gpt-5.1-codex-mini", provider: "openai" },
	"gpt-5": { id: "gpt-5", provider: "openai" },
	"gpt-5-mini": { id: "gpt-5-mini", provider: "openai" },
	"gpt-5-nano": { id: "gpt-5-nano", provider: "openai" },

	// Google Gemini models (2025)
	"gemini-3-pro": { id: "gemini-3.0-pro", provider: "google" },
	"gemini-3-flash": { id: "gemini-3.0-flash", provider: "google" },
	"gemini-2.5-pro": { id: "gemini-2.5-pro", provider: "google" },
	"gemini-2.5-flash": { id: "gemini-2.5-flash", provider: "google" },
	"gemini-2.5-flash-lite": { id: "gemini-2.5-flash-lite", provider: "google" },

	// cursor 
	"composer1": { id: "composer1", provider: "cursor" },
};

/**
 * Resolves a model name to its full definition
 * Checks custom models first, then falls back to defaults
 */
export function resolveModel(
	modelName: string,
	customModels?: Record<string, ModelDefinition>,
): ModelDefinition | null {
	// Check custom models first
	if (customModels?.[modelName]) {
		return customModels[modelName];
	}

	// Fall back to defaults
	if (DEFAULT_MODELS[modelName]) {
		return DEFAULT_MODELS[modelName];
	}

	// If it looks like a full model ID (contains / or -), treat it as-is
	if (modelName.includes("/") || modelName.includes("-")) {
		return { id: modelName, provider: "other" };
	}

	return null;
}

/**
 * Get all available model names (defaults + custom)
 */
export function getAvailableModels(
	customModels?: Record<string, ModelDefinition>,
): string[] {
	const defaultNames = Object.keys(DEFAULT_MODELS);
	const customNames = customModels ? Object.keys(customModels) : [];

	return [...new Set([...defaultNames, ...customNames])].sort();
}
