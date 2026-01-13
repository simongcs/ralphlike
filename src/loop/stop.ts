import type { StopConditions } from "../config/schema.js";

export interface StopCheckContext {
	iteration: number;
	maxIterations: number;
	output: string;
	workingDir: string;
}

export interface StopResult {
	shouldStop: boolean;
	reason?: string;
}

export function checkStopConditions(
	conditions: StopConditions,
	context: StopCheckContext,
): StopResult {
	// 1. Max iterations (always checked first)
	if (conditions.maxIterations && context.iteration >= context.maxIterations) {
		return {
			shouldStop: true,
			reason: `Reached max iterations (${context.maxIterations})`,
		};
	}

	// 2. Output pattern
	if (conditions.outputPattern.enabled && conditions.outputPattern.pattern) {
		const regex = new RegExp(conditions.outputPattern.pattern);
		if (regex.test(context.output)) {
			return {
				shouldStop: true,
				reason: `Output pattern matched: ${conditions.outputPattern.pattern}`,
			};
		}
	}

	// 3. Hook (checked separately via runStopHook)
	// Hook execution is async and handled in the runner

	return { shouldStop: false };
}

export async function runStopHook(
	command: string,
	env: Record<string, string>,
): Promise<StopResult> {
	const { spawn } = await import("node:child_process");

	return new Promise((resolve) => {
		const child = spawn("sh", ["-c", command], {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, ...env },
			cwd: process.cwd(),
		});

		child.on("close", (code) => {
			// Exit code 0 = should stop
			if (code === 0) {
				resolve({
					shouldStop: true,
					reason: `Stop hook returned success: ${command}`,
				});
			} else {
				resolve({ shouldStop: false });
			}
		});

		child.on("error", () => {
			resolve({ shouldStop: false });
		});
	});
}
