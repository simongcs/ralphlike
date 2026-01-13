import { BaseToolAdapter } from "./adapter.js";

export class CursorAdapter extends BaseToolAdapter {
	name = "cursor";

	getCommandName(): string {
		return "agent";
	}
}
