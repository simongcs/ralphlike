import { homedir } from "node:os";
import { join } from "node:path";
import { BaseToolAdapter } from "./adapter.js";

export class ClaudeCodeAdapter extends BaseToolAdapter {
	name = "claude-code";

	getCommandName(): string {
		return "claude";
	}

	protected getCommonPaths(): string[] {
		const home = homedir();
		return [
			join(home, ".claude", "local", "claude"), // Official Claude CLI installation
			"/usr/local/bin/claude",
			join(home, ".local", "bin", "claude"),
		];
	}
}
