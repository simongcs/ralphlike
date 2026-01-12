import { spawn } from "node:child_process";
import type { Hooks } from "../config/schema.js";

export interface HookEnvironment {
	RL_ITERATION: string;
	RL_SESSION_NAME: string;
	RL_PROMPT_FILE: string;
	RL_SESSION_DIR: string;
	RL_EXIT_CODE?: string;
	RL_TOOL?: string;
	RL_MODEL?: string;
}

export interface HookResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

async function executeHook(command: string, env: HookEnvironment): Promise<HookResult> {
	return new Promise((resolve) => {
		const child = spawn("sh", ["-c", command], {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, ...env },
			cwd: process.cwd(),
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (code) => {
			resolve({ exitCode: code ?? 1, stdout, stderr });
		});

		child.on("error", (error) => {
			resolve({ exitCode: 1, stdout, stderr: error.message });
		});
	});
}

export class HookExecutor {
	private hooks: Hooks;
	private baseEnv: Omit<HookEnvironment, "RL_EXIT_CODE">;

	constructor(hooks: Hooks, baseEnv: Omit<HookEnvironment, "RL_EXIT_CODE">) {
		this.hooks = hooks;
		this.baseEnv = baseEnv;
	}

	async runPreIteration(iteration: number): Promise<HookResult | null> {
		if (!this.hooks.preIteration) return null;

		const env: HookEnvironment = {
			...this.baseEnv,
			RL_ITERATION: String(iteration),
		};

		return executeHook(this.hooks.preIteration, env);
	}

	async runPostIteration(iteration: number, exitCode: number): Promise<HookResult | null> {
		if (!this.hooks.postIteration) return null;

		const env: HookEnvironment = {
			...this.baseEnv,
			RL_ITERATION: String(iteration),
			RL_EXIT_CODE: String(exitCode),
		};

		return executeHook(this.hooks.postIteration, env);
	}

	async runOnError(iteration: number, exitCode: number): Promise<HookResult | null> {
		if (!this.hooks.onError) return null;

		const env: HookEnvironment = {
			...this.baseEnv,
			RL_ITERATION: String(iteration),
			RL_EXIT_CODE: String(exitCode),
		};

		return executeHook(this.hooks.onError, env);
	}

	async runOnComplete(totalIterations: number, stopReason: string): Promise<HookResult | null> {
		if (!this.hooks.onComplete) return null;

		const env: HookEnvironment & { RL_STOP_REASON: string; RL_TOTAL_ITERATIONS: string } = {
			...this.baseEnv,
			RL_ITERATION: String(totalIterations),
			RL_STOP_REASON: stopReason,
			RL_TOTAL_ITERATIONS: String(totalIterations),
		};

		return executeHook(this.hooks.onComplete, env);
	}
}
