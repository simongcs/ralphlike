import { BaseToolAdapter } from "./adapter.js";

export class CodexAdapter extends BaseToolAdapter {
	name = "codex";

	getCommandName(): string {
		return "codex";
	}
}
