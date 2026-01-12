import { spawn } from "node:child_process";

export interface CommitOptions {
	message: string;
	addAll?: boolean;
}

export interface CommitResult {
	success: boolean;
	commitHash?: string;
	error?: string;
}

export interface GitStatus {
	hasChanges: boolean;
	staged: number;
	unstaged: number;
	untracked: number;
}

async function runGit(
	args: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn("git", args, {
			stdio: ["ignore", "pipe", "pipe"],
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

export async function isGitRepository(): Promise<boolean> {
	const result = await runGit(["rev-parse", "--is-inside-work-tree"]);
	return result.exitCode === 0 && result.stdout.trim() === "true";
}

export async function getGitStatus(): Promise<GitStatus> {
	const result = await runGit(["status", "--porcelain"]);

	if (result.exitCode !== 0) {
		return { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 };
	}

	const lines = result.stdout.trim().split("\n").filter(Boolean);

	let staged = 0;
	let unstaged = 0;
	let untracked = 0;

	for (const line of lines) {
		const indexStatus = line[0];
		const workTreeStatus = line[1];

		if (indexStatus === "?" && workTreeStatus === "?") {
			untracked++;
		} else {
			if (indexStatus !== " " && indexStatus !== "?") {
				staged++;
			}
			if (workTreeStatus !== " " && workTreeStatus !== "?") {
				unstaged++;
			}
		}
	}

	return {
		hasChanges: lines.length > 0,
		staged,
		unstaged,
		untracked,
	};
}

export async function stageAll(): Promise<boolean> {
	const result = await runGit(["add", "-A"]);
	return result.exitCode === 0;
}

export async function commit(options: CommitOptions): Promise<CommitResult> {
	if (options.addAll) {
		const stageResult = await stageAll();
		if (!stageResult) {
			return { success: false, error: "Failed to stage changes" };
		}
	}

	// Check if there are staged changes
	const status = await getGitStatus();
	if (status.staged === 0 && !options.addAll) {
		return { success: false, error: "No staged changes to commit" };
	}

	// If we staged all but there's nothing to commit
	if (options.addAll && !status.hasChanges) {
		return { success: false, error: "No changes to commit" };
	}

	const result = await runGit(["commit", "-m", options.message]);

	if (result.exitCode !== 0) {
		return { success: false, error: result.stderr || "Commit failed" };
	}

	// Extract commit hash
	const hashMatch = result.stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
	const commitHash = hashMatch ? hashMatch[1] : undefined;

	return { success: true, commitHash };
}

export function formatCommitMessage(
	template: string,
	variables: { iteration: number; sessionName: string; tool?: string },
): string {
	return template
		.replace(/\{iteration\}/g, String(variables.iteration))
		.replace(/\{sessionName\}/g, variables.sessionName)
		.replace(/\{tool\}/g, variables.tool || "unknown");
}

export async function getDiffStats(): Promise<
	{ files: number; insertions: number; deletions: number } | undefined
> {
	const result = await runGit(["diff", "--cached", "--stat"]);

	if (result.exitCode !== 0 || !result.stdout.trim()) {
		return undefined;
	}

	const lines = result.stdout.trim().split("\n");
	const summaryLine = lines[lines.length - 1];

	// Parse: " 3 files changed, 10 insertions(+), 5 deletions(-)"
	const filesMatch = summaryLine.match(/(\d+) files? changed/);
	const insertionsMatch = summaryLine.match(/(\d+) insertions?\(\+\)/);
	const deletionsMatch = summaryLine.match(/(\d+) deletions?\(-\)/);

	return {
		files: filesMatch ? Number.parseInt(filesMatch[1], 10) : 0,
		insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1], 10) : 0,
		deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1], 10) : 0,
	};
}
