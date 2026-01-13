/**
 * Token usage tracking for different AI coding tools
 *
 * Each tool reports token usage differently in its output.
 * This module provides parsers to extract token counts from tool outputs.
 */

export interface TokenUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
	cost?: number; // Cost in dollars
}

export type TokenParser = (output: string) => TokenUsage | null;

/**
 * Parse Claude Code token usage from output
 *
 * Claude Code (--print mode) outputs usage in several possible formats:
 * - "Total tokens: 1234 in, 567 out"
 * - "Input: 1234 tokens, Output: 567 tokens"
 * - Cost line: "Total cost: $0.0123"
 * - Cache stats: "Cache read: 100, Cache write: 50"
 */
export function parseClaudeCodeTokens(output: string): TokenUsage | null {
	const usage: TokenUsage = {};
	let found = false;

	// Pattern 1: "Total tokens: X in, Y out"
	const totalPattern = /Total tokens:\s*(\d+)\s*in,\s*(\d+)\s*out/i;
	const totalMatch = output.match(totalPattern);
	if (totalMatch) {
		usage.inputTokens = Number.parseInt(totalMatch[1], 10);
		usage.outputTokens = Number.parseInt(totalMatch[2], 10);
		usage.totalTokens = usage.inputTokens + usage.outputTokens;
		found = true;
	}

	// Pattern 2: "Input: X tokens" and "Output: Y tokens" (separate lines)
	const inputPattern = /Input:\s*(\d+)\s*tokens?/i;
	const outputPattern = /Output:\s*(\d+)\s*tokens?/i;
	const inputMatch = output.match(inputPattern);
	const outputMatch = output.match(outputPattern);
	if (inputMatch && outputMatch) {
		usage.inputTokens = Number.parseInt(inputMatch[1], 10);
		usage.outputTokens = Number.parseInt(outputMatch[1], 10);
		usage.totalTokens = usage.inputTokens + usage.outputTokens;
		found = true;
	}

	// Pattern 3: "input_tokens: X" and "output_tokens: Y" (JSON-style)
	const inputJsonPattern = /input_tokens["\s:]+(\d+)/i;
	const outputJsonPattern = /output_tokens["\s:]+(\d+)/i;
	const inputJsonMatch = output.match(inputJsonPattern);
	const outputJsonMatch = output.match(outputJsonPattern);
	if (inputJsonMatch || outputJsonMatch) {
		if (inputJsonMatch) {
			usage.inputTokens = Number.parseInt(inputJsonMatch[1], 10);
			found = true;
		}
		if (outputJsonMatch) {
			usage.outputTokens = Number.parseInt(outputJsonMatch[1], 10);
			found = true;
		}
		if (usage.inputTokens && usage.outputTokens) {
			usage.totalTokens = usage.inputTokens + usage.outputTokens;
		}
	}

	// Pattern 4: Cost line "Total cost: $X.XX" or "Cost: $X.XX"
	const costPattern = /(?:Total\s+)?[Cc]ost:\s*\$?([\d.]+)/;
	const costMatch = output.match(costPattern);
	if (costMatch) {
		usage.cost = Number.parseFloat(costMatch[1]);
		found = true;
	}

	// Pattern 5: Cache tokens "cache_read_input_tokens: X" or "Cache read: X"
	const cacheReadPattern = /cache[_\s]?read[_\s]?(?:input[_\s]?)?tokens?["\s:]+(\d+)/i;
	const cacheWritePattern = /cache[_\s]?(?:creation|write)[_\s]?(?:input[_\s]?)?tokens?["\s:]+(\d+)/i;
	const cacheReadMatch = output.match(cacheReadPattern);
	const cacheWriteMatch = output.match(cacheWritePattern);
	if (cacheReadMatch) {
		usage.cacheReadTokens = Number.parseInt(cacheReadMatch[1], 10);
		found = true;
	}
	if (cacheWriteMatch) {
		usage.cacheWriteTokens = Number.parseInt(cacheWriteMatch[1], 10);
		found = true;
	}

	return found ? usage : null;
}

/**
 * Parse OpenCode token usage from output
 *
 * OpenCode can use multiple providers (OpenAI, Anthropic, Gemini)
 * and outputs usage in various formats depending on the provider.
 */
export function parseOpenCodeTokens(output: string): TokenUsage | null {
	const usage: TokenUsage = {};
	let found = false;

	// OpenAI format: "prompt_tokens: X, completion_tokens: Y"
	const promptPattern = /prompt[_\s]?tokens["\s:]+(\d+)/i;
	const completionPattern = /completion[_\s]?tokens["\s:]+(\d+)/i;
	const promptMatch = output.match(promptPattern);
	const completionMatch = output.match(completionPattern);
	if (promptMatch || completionMatch) {
		if (promptMatch) {
			usage.inputTokens = Number.parseInt(promptMatch[1], 10);
			found = true;
		}
		if (completionMatch) {
			usage.outputTokens = Number.parseInt(completionMatch[1], 10);
			found = true;
		}
	}

	// Gemini format: "promptTokenCount: X, candidatesTokenCount: Y"
	const geminiPromptPattern = /prompt[_\s]?token[_\s]?count["\s:]+(\d+)/i;
	const geminiCandidatesPattern = /candidates[_\s]?token[_\s]?count["\s:]+(\d+)/i;
	const geminiPromptMatch = output.match(geminiPromptPattern);
	const geminiCandidatesMatch = output.match(geminiCandidatesPattern);
	if (geminiPromptMatch || geminiCandidatesMatch) {
		if (geminiPromptMatch) {
			usage.inputTokens = Number.parseInt(geminiPromptMatch[1], 10);
			found = true;
		}
		if (geminiCandidatesMatch) {
			usage.outputTokens = Number.parseInt(geminiCandidatesMatch[1], 10);
			found = true;
		}
	}

	// Generic total pattern: "total_tokens: X" or "totalTokenCount: X"
	const totalPattern = /total[_\s]?tokens?[_\s]?(?:count)?["\s:]+(\d+)/i;
	const totalMatch = output.match(totalPattern);
	if (totalMatch) {
		usage.totalTokens = Number.parseInt(totalMatch[1], 10);
		found = true;
	}

	// Try Anthropic format as fallback (opencode can use Claude)
	if (!found) {
		return parseClaudeCodeTokens(output);
	}

	// Calculate total if we have both
	if (usage.inputTokens && usage.outputTokens && !usage.totalTokens) {
		usage.totalTokens = usage.inputTokens + usage.outputTokens;
	}

	return found ? usage : null;
}

/**
 * Parse Cursor agent token usage from output
 */
export function parseCursorTokens(output: string): TokenUsage | null {
	const usage: TokenUsage = {};
	let found = false;

	// Cursor may output usage in various formats
	// Try common patterns
	const inputPattern = /(?:input|prompt)[_\s]?tokens?["\s:]+(\d+)/i;
	const outputPattern = /(?:output|completion|response)[_\s]?tokens?["\s:]+(\d+)/i;
	const totalPattern = /total[_\s]?tokens?["\s:]+(\d+)/i;

	const inputMatch = output.match(inputPattern);
	const outputMatch = output.match(outputPattern);
	const totalMatch = output.match(totalPattern);

	if (inputMatch) {
		usage.inputTokens = Number.parseInt(inputMatch[1], 10);
		found = true;
	}
	if (outputMatch) {
		usage.outputTokens = Number.parseInt(outputMatch[1], 10);
		found = true;
	}
	if (totalMatch) {
		usage.totalTokens = Number.parseInt(totalMatch[1], 10);
		found = true;
	}

	// Calculate total if we have both input and output
	if (usage.inputTokens && usage.outputTokens && !usage.totalTokens) {
		usage.totalTokens = usage.inputTokens + usage.outputTokens;
	}

	return found ? usage : null;
}

/**
 * Parse Codex token usage from output
 *
 * Codex CLI outputs token usage in a specific format:
 * ```
 * tokens used
 * 7,116
 * ```
 * The number may contain commas as thousand separators.
 */
export function parseCodexTokens(output: string): TokenUsage | null {
	const usage: TokenUsage = {};
	let found = false;

	// Codex specific format: "tokens used" followed by number on next line
	// The number may have commas (e.g., "7,116")
	const codexPattern = /tokens\s+used\s*\n\s*([\d,]+)/i;
	const codexMatch = output.match(codexPattern);
	if (codexMatch) {
		// Remove commas and parse
		const tokenCount = Number.parseInt(codexMatch[1].replace(/,/g, ""), 10);
		usage.totalTokens = tokenCount;
		found = true;
	}

	// Also try OpenAI format as fallback
	if (!found) {
		return parseOpenCodeTokens(output);
	}

	return found ? usage : null;
}

/**
 * Get the appropriate token parser for a tool
 */
export function getTokenParser(toolName: string): TokenParser {
	switch (toolName) {
		case "claude-code":
			return parseClaudeCodeTokens;
		case "opencode":
			return parseOpenCodeTokens;
		case "cursor":
			return parseCursorTokens;
		case "codex":
			return parseCodexTokens;
		default:
			// Generic parser that tries multiple formats
			return (output: string) => {
				return (
					parseClaudeCodeTokens(output) ||
					parseOpenCodeTokens(output) ||
					parseCursorTokens(output) ||
					null
				);
			};
	}
}

/**
 * Format token usage for display
 */
export function formatTokenUsage(usage: TokenUsage): string {
	const parts: string[] = [];

	if (usage.inputTokens !== undefined) {
		parts.push(`${usage.inputTokens.toLocaleString()} in`);
	}
	if (usage.outputTokens !== undefined) {
		parts.push(`${usage.outputTokens.toLocaleString()} out`);
	}

	let result = parts.length > 0 ? parts.join(", ") : "";

	if (usage.totalTokens !== undefined && parts.length === 0) {
		result = `${usage.totalTokens.toLocaleString()} total`;
	}

	if (usage.cacheReadTokens !== undefined || usage.cacheWriteTokens !== undefined) {
		const cacheParts: string[] = [];
		if (usage.cacheReadTokens !== undefined) {
			cacheParts.push(`read: ${usage.cacheReadTokens.toLocaleString()}`);
		}
		if (usage.cacheWriteTokens !== undefined) {
			cacheParts.push(`write: ${usage.cacheWriteTokens.toLocaleString()}`);
		}
		if (result) {
			result += ` (cache: ${cacheParts.join(", ")})`;
		} else {
			result = `cache: ${cacheParts.join(", ")}`;
		}
	}

	if (usage.cost !== undefined) {
		const costStr = `$${usage.cost.toFixed(4)}`;
		result = result ? `${result} - ${costStr}` : costStr;
	}

	return result || "unknown";
}
