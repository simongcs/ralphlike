import { readFileSync } from "node:fs";
import { basename } from "node:path";

export interface ParsedPrompt {
	content: string;
	tasks: string[];
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
