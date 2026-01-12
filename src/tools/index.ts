import type { ToolAdapter } from "./adapter.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";

export type { ToolAdapter, ExecutionResult } from "./adapter.js";

const adapters: Record<string, ToolAdapter> = {
	"claude-code": new ClaudeCodeAdapter(),
	opencode: new OpenCodeAdapter(),
	cursor: new CursorAdapter(),
	codex: new CodexAdapter(),
};

export function getAdapter(toolName: string): ToolAdapter {
	const adapter = adapters[toolName];
	if (!adapter) {
		throw new Error(
			`Unknown tool: ${toolName}. Available tools: ${Object.keys(adapters).join(", ")}`,
		);
	}
	return adapter;
}

export async function getAvailableTools(): Promise<string[]> {
	const available: string[] = [];
	for (const [name, adapter] of Object.entries(adapters)) {
		if (await adapter.isAvailable()) {
			available.push(name);
		}
	}
	return available;
}

export function getAllToolNames(): string[] {
	return Object.keys(adapters);
}
