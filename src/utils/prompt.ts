import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ParsedPrompt {
	content: string;
	tasks: string[];
}

export interface CombinedPrompt {
	filePath: string;
	cleanup: () => void;
}

export function parsePromptFile(filePath: string): ParsedPrompt {
	const content = readFileSync(filePath, "utf-8");
	const tasks = extractTasks(content);

	return { content, tasks };
}

export function extractTasks(content: string): string[] {
	// Match markdown checkbox items: - [ ] task or * [ ] task
	const checkboxRegex = /^[\s]*[-*]\s*\[[ x]\]\s*(.+)$/gim;
	const matches = content.matchAll(checkboxRegex);

	return Array.from(matches, (match) => match[1].trim());
}

export function deriveSessionName(promptFilePath: string): string | undefined {
	const filename = basename(promptFilePath);

	// Remove extension
	const nameWithoutExt = filename.replace(/\.(md|txt|markdown)$/i, "");

	// Check if it's a generic name
	const genericNames = ["prompt", "plan", "task", "tasks", "todo", "readme"];
	if (genericNames.includes(nameWithoutExt.toLowerCase())) {
		return undefined; // Signal that we need to ask the user
	}

	// Extract meaningful name from patterns like:
	// - feature-auth.md -> auth
	// - prompt-login.md -> login
	// - auth.md -> auth
	const prefixPattern = /^(?:feature|prompt|task|plan)[-_](.+)$/i;
	const prefixMatch = nameWithoutExt.match(prefixPattern);

	if (prefixMatch) {
		return prefixMatch[1].toLowerCase();
	}

	return nameWithoutExt.toLowerCase();
}

export function generateChecklist(tasks: string[]): string {
	if (tasks.length === 0) {
		return "# Checklist\n\nNo tasks detected in prompt.\n";
	}

	const lines = ["# Checklist", "", "Tasks extracted from prompt:", ""];

	for (const task of tasks) {
		lines.push(`- [ ] ${task}`);
	}

	lines.push("");
	return lines.join("\n");
}

export function updateChecklistItem(
	checklistContent: string,
	taskIndex: number,
	completed: boolean,
): string {
	const lines = checklistContent.split("\n");
	let taskCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (/^[\s]*[-*]\s*\[[ x]\]/.test(line)) {
			if (taskCount === taskIndex) {
				lines[i] = completed ? line.replace(/\[ \]/, "[x]") : line.replace(/\[x\]/i, "[ ]");
				break;
			}
			taskCount++;
		}
	}

	return lines.join("\n");
}

export interface CombinedPromptOptions {
	includeSystemPrompt?: boolean;
	sessionName?: string;
}

/**
 * Combines the system prompt with a user prompt file and creates a temporary file
 * @param userPromptFile Path to the user's prompt file
 * @param options Configuration options (includeSystemPrompt, sessionName)
 * @returns Object containing the path to the combined prompt file and a cleanup function
 */
export function createCombinedPrompt(
	userPromptFile: string,
	options: CombinedPromptOptions | boolean = {},
): CombinedPrompt {
	// Handle legacy boolean parameter for backwards compatibility
	const opts: CombinedPromptOptions =
		typeof options === "boolean" ? { includeSystemPrompt: options } : options;

	const { includeSystemPrompt = true, sessionName } = opts;

	// Read user prompt
	const userPrompt = readFileSync(userPromptFile, "utf-8");

	let combinedContent = userPrompt;

	if (includeSystemPrompt) {
		// Find the system prompt file (in dist/prompts after build)
		const systemPromptPath = join(__dirname, "prompts", "system-prompt.md");

		if (existsSync(systemPromptPath)) {
			let systemPrompt = readFileSync(systemPromptPath, "utf-8");

			// Replace {session} placeholder with actual session name
			if (sessionName) {
				systemPrompt = systemPrompt.replace(/\{session\}/g, sessionName);
			}

			// Combine: system prompt first, then user prompt
			combinedContent = `${systemPrompt}\n\n${userPrompt}`;
		}
	}

	// Create temporary file
	const tempDir = mkdtempSync(join(tmpdir(), "rl-prompt-"));
	const tempFile = join(tempDir, "combined-prompt.md");
	writeFileSync(tempFile, combinedContent, "utf-8");

	// Return the file path and cleanup function
	return {
		filePath: tempFile,
		cleanup: () => {
			try {
				// Clean up temp file and directory
				rmSync(tempDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		},
	};
}
