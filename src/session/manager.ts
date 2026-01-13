import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deriveSessionName } from "../utils/prompt.js";

export interface SessionInfo {
	name: string;
	dir: string;
	promptFile: string;
	progressFile: string;
	checklistFile: string;
	originalPromptCopy: string;
	isResumed: boolean;
}

export interface CreateSessionOptions {
	promptFile: string;
	sessionName?: string;
	workingDir?: string;
}

export class SessionManager {
	private ralphDir: string;

	constructor(workingDir: string = process.cwd()) {
		this.ralphDir = join(workingDir, ".ralph");
	}

	ensureRalphDir(): void {
		if (!existsSync(this.ralphDir)) {
			mkdirSync(this.ralphDir, { recursive: true });
		}
	}

	async createSession(options: CreateSessionOptions): Promise<SessionInfo> {
		const { promptFile, sessionName } = options;
		const absolutePromptPath = resolve(process.cwd(), promptFile);

		if (!existsSync(absolutePromptPath)) {
			throw new Error(`Prompt file not found: ${absolutePromptPath}`);
		}

		// Determine session name
		let name = sessionName;
		if (!name) {
			name = deriveSessionName(promptFile);
		}

		// If still no name (generic filename), generate timestamp-based name
		if (!name) {
			const now = new Date();
			const timestamp = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
			name = `session-${timestamp}`;
		}

		// Create session directory
		this.ensureRalphDir();
		const sessionDir = join(this.ralphDir, name);

		if (existsSync(sessionDir)) {
			// Append timestamp to make unique
			const timestamp = Date.now();
			name = `${name}-${timestamp}`;
		}

		const finalSessionDir = join(this.ralphDir, name);
		mkdirSync(finalSessionDir, { recursive: true });

		// Copy prompt file
		const promptCopyPath = join(finalSessionDir, "prompt.md");
		copyFileSync(absolutePromptPath, promptCopyPath);

		// Checklist will be created by the agent on first run
		const checklistPath = join(finalSessionDir, "checklist.md");

		// Create empty progress file
		const progressPath = join(finalSessionDir, "progress.md");

		return {
			name,
			dir: finalSessionDir,
			promptFile: absolutePromptPath,
			progressFile: progressPath,
			checklistFile: checklistPath,
			originalPromptCopy: promptCopyPath,
			isResumed: false,
		};
	}

	/**
	 * Get an existing session or create a new one.
	 * If a session with the derived name already exists, resume it instead of creating a new one.
	 */
	async getOrCreateSession(options: CreateSessionOptions): Promise<SessionInfo> {
		const { promptFile, sessionName } = options;
		const absolutePromptPath = resolve(process.cwd(), promptFile);

		if (!existsSync(absolutePromptPath)) {
			throw new Error(`Prompt file not found: ${absolutePromptPath}`);
		}

		// Determine session name
		let name = sessionName;
		if (!name) {
			name = deriveSessionName(promptFile);
		}

		// If still no name (generic filename), generate timestamp-based name
		if (!name) {
			const now = new Date();
			const timestamp = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
			name = `session-${timestamp}`;
		}

		// Check if session already exists - if so, resume it
		this.ensureRalphDir();
		const sessionDir = join(this.ralphDir, name);

		if (existsSync(sessionDir)) {
			// Resume existing session
			const checklistPath = join(sessionDir, "checklist.md");
			const progressPath = join(sessionDir, "progress.md");
			const promptCopyPath = join(sessionDir, "prompt.md");

			return {
				name,
				dir: sessionDir,
				promptFile: absolutePromptPath,
				progressFile: progressPath,
				checklistFile: checklistPath,
				originalPromptCopy: promptCopyPath,
				isResumed: true,
			};
		}

		// Create new session
		mkdirSync(sessionDir, { recursive: true });

		// Copy prompt file
		const promptCopyPath = join(sessionDir, "prompt.md");
		copyFileSync(absolutePromptPath, promptCopyPath);

		// Checklist will be created by the agent on first run
		const checklistPath = join(sessionDir, "checklist.md");

		// Create empty progress file
		const progressPath = join(sessionDir, "progress.md");

		return {
			name,
			dir: sessionDir,
			promptFile: absolutePromptPath,
			progressFile: progressPath,
			checklistFile: checklistPath,
			originalPromptCopy: promptCopyPath,
			isResumed: false,
		};
	}

	getSessionDir(sessionName: string): string {
		return join(this.ralphDir, sessionName);
	}

	sessionExists(sessionName: string): boolean {
		return existsSync(this.getSessionDir(sessionName));
	}

	readChecklist(session: SessionInfo): string {
		if (existsSync(session.checklistFile)) {
			return readFileSync(session.checklistFile, "utf-8");
		}
		return "";
	}

	writeChecklist(session: SessionInfo, content: string): void {
		writeFileSync(session.checklistFile, content, "utf-8");
	}
}
