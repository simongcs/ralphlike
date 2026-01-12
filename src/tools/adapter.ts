import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolConfig } from "../config/schema.js";

export interface ExecutionResult {
	exitCode: number;
	stdout: string;
	stderr: string;
	duration: number;
}

export interface ToolAdapter {
	name: string;
	isAvailable(): Promise<boolean>;
	buildCommand(promptFile: string, config: ToolConfig, model?: string): Promise<string>;
	execute(command: string): Promise<ExecutionResult>;
}

export abstract class BaseToolAdapter implements ToolAdapter {
	abstract name: string;

	async isAvailable(): Promise<boolean> {
		const resolvedPath = await this.resolveCommandPath();
		return resolvedPath !== null;
	}

	// Resolve the full path to the command executable
	async resolveCommandPath(): Promise<string | null> {
		try {
			const commandName = this.getCommandName();

			// Try common installation locations first (handles shell aliases)
			const commonPaths = this.getCommonPaths();
			for (const path of commonPaths) {
				if (existsSync(path)) {
					return path;
				}
			}

			// Fallback: try which command in case it's in PATH
			const result = await this.executeRaw("/bin/bash", ["-l", "-c", `which ${commandName}`]);
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}

			return null;
		} catch {
			return null;
		}
	}

	// Override this in subclasses to provide tool-specific installation paths
	protected getCommonPaths(): string[] {
		return [];
	}

	abstract getCommandName(): string;

	async buildCommand(promptFile: string, config: ToolConfig, model?: string): Promise<string> {
		const absolutePath = resolve(process.cwd(), promptFile);

		if (!existsSync(absolutePath)) {
			throw new Error(`Prompt file not found: ${absolutePath}`);
		}

		// Resolve the full path to the command
		const commandPath = await this.resolveCommandPath();
		if (!commandPath) {
			throw new Error(`Command ${this.getCommandName()} not found`);
		}

		let command = config.template;

		// Replace command name with full path in the template
		const commandName = this.getCommandName();
		command = command.replace(new RegExp(`\\b${commandName}\\b`, 'g'), commandPath);

		command = command.replace(/\{promptFile\}/g, absolutePath);

		if (model) {
			command = command.replace(/\{model\}/g, model);
		} else if (config.model) {
			command = command.replace(/\{model\}/g, config.model);
		}

		return command;
	}

	async execute(command: string): Promise<ExecutionResult> {
		const startTime = Date.now();

		return new Promise((resolve) => {
			const child = spawn("sh", ["-c", command], {
				stdio: ["inherit", "pipe", "pipe"],
				cwd: process.cwd(),
			});

			let stdout = "";
			let stderr = "";

			child.stdout?.on("data", (data) => {
				const text = data.toString();
				stdout += text;
				process.stdout.write(text);
			});

			child.stderr?.on("data", (data) => {
				const text = data.toString();
				stderr += text;
				process.stderr.write(text);
			});

			child.on("close", (code) => {
				resolve({
					exitCode: code ?? 1,
					stdout,
					stderr,
					duration: Date.now() - startTime,
				});
			});

			child.on("error", (error) => {
				resolve({
					exitCode: 1,
					stdout,
					stderr: stderr + error.message,
					duration: Date.now() - startTime,
				});
			});
		});
	}

	protected executeRaw(
		command: string,
		args: string[],
	): Promise<{ exitCode: number; stdout: string; stderr: string }> {
		return new Promise((resolve) => {
			const child = spawn(command, args, {
				stdio: ["ignore", "pipe", "pipe"],
				env: process.env
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

			child.on("error", () => {
				resolve({ exitCode: 1, stdout, stderr });
			});
		});
	}
}
