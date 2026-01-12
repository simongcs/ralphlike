import { BaseToolAdapter } from "./adapter.js";

export class OpenCodeAdapter extends BaseToolAdapter {
	name = "opencode";

	getCommandName(): string {
		return "opencode";
	}
}
