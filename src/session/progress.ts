import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import type { SessionInfo } from "./manager.js";
import type { TokenUsage } from "../tools/tokens.js";
import { formatTokenUsage } from "../tools/tokens.js";

export interface ProgressHeader {
	sessionName: string;
	startTime: Date;
	tool: string;
	model: string;
	maxIterations: number;
	isResumed?: boolean;
}

export interface IterationProgress {
	iteration: number;
	timestamp: Date;
	status: "completed" | "failed" | "retried";
	duration: number;
	filesChanged?: number;
	diffSummary?: string;
	exitCode: number;
	tokens?: TokenUsage;
}

export interface SessionSummary {
	totalIterations: number;
	stopReason: string;
	totalDuration: number;
	totalTokens?: TokenUsage;
}

export class ProgressWriter {
	private session: SessionInfo;
	private startTime: Date;

	constructor(session: SessionInfo) {
		this.session = session;
		this.startTime = new Date();
	}

	writeHeader(header: ProgressHeader): void {
		// If resuming and progress file exists, append a resume marker instead of overwriting
		if (header.isResumed && existsSync(this.session.progressFile)) {
			const lines = [
				"",
				"---",
				"",
				`## Resumed: ${header.startTime.toISOString().replace("T", " ").slice(0, 19)}`,
				`Tool: ${header.tool}`,
				`Model: ${header.model}`,
				`Max Iterations: ${header.maxIterations}`,
				"",
			];
			appendFileSync(this.session.progressFile, lines.join("\n"), "utf-8");
			return;
		}

		const lines = [
			`# Session: ${header.sessionName}`,
			`Started: ${header.startTime.toISOString().replace("T", " ").slice(0, 19)}`,
			`Tool: ${header.tool}`,
			`Model: ${header.model}`,
			`Max Iterations: ${header.maxIterations}`,
			"",
			"---",
			"",
		];

		writeFileSync(this.session.progressFile, lines.join("\n"), "utf-8");
	}

	appendIteration(progress: IterationProgress): void {
		const timeStr = progress.timestamp.toTimeString().slice(0, 8);
		const durationSec = (progress.duration / 1000).toFixed(1);

		const lines = [
			`## Iteration ${progress.iteration} - ${timeStr}`,
			`- Status: ${progress.status}`,
			`- Duration: ${durationSec}s`,
			`- Exit code: ${progress.exitCode}`,
		];

		if (progress.tokens) {
			lines.push(`- Tokens: ${formatTokenUsage(progress.tokens)}`);
		}

		if (progress.filesChanged !== undefined) {
			lines.push(`- Files changed: ${progress.filesChanged}`);
		}

		if (progress.diffSummary) {
			lines.push(`- Git diff: ${progress.diffSummary}`);
		}

		lines.push("");

		appendFileSync(this.session.progressFile, lines.join("\n"), "utf-8");
	}

	writeSummary(summary: SessionSummary): void {
		const durationMin = (summary.totalDuration / 1000 / 60).toFixed(1);

		const lines = [
			"---",
			"",
			"## Summary",
			`Total iterations: ${summary.totalIterations}`,
			`Stop reason: ${summary.stopReason}`,
			`Duration: ${durationMin}m`,
		];

		if (summary.totalTokens) {
			lines.push(`Total tokens: ${formatTokenUsage(summary.totalTokens)}`);
		}

		lines.push("");

		appendFileSync(this.session.progressFile, lines.join("\n"), "utf-8");
	}

	getElapsedTime(): number {
		return Date.now() - this.startTime.getTime();
	}
}

export async function getGitDiffSummary(): Promise<string | undefined> {
	try {
		const { spawn } = await import("node:child_process");

		return new Promise((resolve) => {
			const child = spawn("git", ["diff", "--stat", "HEAD~1", "--"], {
				stdio: ["ignore", "pipe", "pipe"],
				cwd: process.cwd(),
			});

			let stdout = "";

			child.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			child.on("close", (code) => {
				if (code === 0 && stdout.trim()) {
					// Extract summary line like " 3 files changed, 10 insertions(+), 5 deletions(-)"
					const lines = stdout.trim().split("\n");
					const summaryLine = lines[lines.length - 1];
					if (summaryLine.includes("changed")) {
						resolve(summaryLine.trim());
					} else {
						resolve(undefined);
					}
				} else {
					resolve(undefined);
				}
			});

			child.on("error", () => {
				resolve(undefined);
			});
		});
	} catch {
		return undefined;
	}
}

export async function getFilesChangedCount(): Promise<number | undefined> {
	try {
		const { spawn } = await import("node:child_process");

		return new Promise((resolve) => {
			const child = spawn("git", ["diff", "--name-only", "HEAD~1", "--"], {
				stdio: ["ignore", "pipe", "pipe"],
				cwd: process.cwd(),
			});

			let stdout = "";

			child.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			child.on("close", (code) => {
				if (code === 0) {
					const files = stdout.trim().split("\n").filter(Boolean);
					resolve(files.length);
				} else {
					resolve(undefined);
				}
			});

			child.on("error", () => {
				resolve(undefined);
			});
		});
	} catch {
		return undefined;
	}
}
