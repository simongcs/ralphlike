import chalk from "chalk";
import ora from "ora";
import { getToolConfig } from "../config/defaults.js";
import type { Config } from "../config/schema.js";
import { commit, formatCommitMessage, getGitStatus, isGitRepository } from "../git/index.js";
import { type SessionInfo, SessionManager } from "../session/manager.js";
import { ProgressWriter, getFilesChangedCount, getGitDiffSummary } from "../session/progress.js";
import { type ExecutionResult, getAdapter } from "../tools/index.js";
import { createCombinedPrompt } from "../utils/prompt.js";
import { type HookEnvironment, HookExecutor } from "./hooks.js";
import { type StopCheckContext, checkStopConditions, runStopHook } from "./stop.js";

export interface RunOptions {
	promptFile: string;
	config: Config;
	toolName: string;
	model?: string;
	sessionName?: string;
	verbose?: boolean;
	autoCommit?: boolean;
}

export interface RunResult {
	totalIterations: number;
	stopReason: string;
	session: SessionInfo;
	success: boolean;
}

async function performCommit(
	iteration: number,
	sessionName: string,
	template: string,
	tool: string,
): Promise<void> {
	const status = await getGitStatus();
	if (!status.hasChanges) {
		return;
	}

	const message = formatCommitMessage(template, {
		iteration,
		sessionName,
		tool,
	});

	const result = await commit({ message, addAll: true });

	if (result.success) {
		console.log(chalk.dim(`  Committed: ${result.commitHash?.slice(0, 7) || "done"}`));
	} else if (result.error !== "No changes to commit") {
		console.log(chalk.yellow(`  Commit skipped: ${result.error}`));
	}
}

export async function runLoop(options: RunOptions): Promise<RunResult> {
	const { promptFile, config, toolName, model, sessionName, autoCommit } = options;

	// Determine if we should auto-commit
	const shouldAutoCommit = autoCommit ?? config.git.autoCommit;
	const isGitRepo = shouldAutoCommit ? await isGitRepository() : false;

	if (shouldAutoCommit && !isGitRepo) {
		console.log(chalk.yellow("Warning: Auto-commit enabled but not in a git repository"));
	}

	// Get tool adapter and config
	const adapter = getAdapter(toolName);
	const toolConfig = getToolConfig(config, toolName);
	const effectiveModel = model || toolConfig.model;

	// Check tool availability
	const isAvailable = await adapter.isAvailable();
	if (!isAvailable) {
		throw new Error(`Tool '${toolName}' is not installed or not in PATH`);
	}

	// Create session
	const sessionManager = new SessionManager();
	const session = await sessionManager.createSession({
		promptFile,
		sessionName,
	});

	console.log(chalk.dim(`\nSession: ${session.name}`));
	console.log(chalk.dim(`Directory: ${session.dir}`));
	if (shouldAutoCommit && isGitRepo) {
		console.log(chalk.dim(`Auto-commit: ${config.git.commitStrategy}`));
	}
	console.log();

	// Initialize progress writer
	const progressWriter = new ProgressWriter(session);
	progressWriter.writeHeader({
		sessionName: session.name,
		startTime: new Date(),
		tool: toolName,
		model: effectiveModel || "default",
		maxIterations: config.maxIterations,
	});

	// Initialize hook executor
	const baseHookEnv: HookEnvironment = {
		RL_SESSION_NAME: session.name,
		RL_PROMPT_FILE: session.promptFile,
		RL_SESSION_DIR: session.dir,
		RL_TOOL: toolName,
		RL_MODEL: effectiveModel,
		RL_ITERATION: "0", // Will be overwritten per iteration
	};

	const hookExecutor = new HookExecutor(config.hooks, baseHookEnv);

	// Create combined prompt (system prompt + user prompt)
	const combinedPrompt = createCombinedPrompt(promptFile, {
		includeSystemPrompt: true,
		sessionName: session.name,
	});

	try {
		// Build command using the combined prompt file
		const command = await adapter.buildCommand(combinedPrompt.filePath, toolConfig, effectiveModel);

		let iteration = 0;
		let stopReason = "unknown";
		let lastOutput = "";

		// Main loop
		while (iteration < config.maxIterations) {
			iteration++;

			const spinner = ora(`Iteration ${iteration}/${config.maxIterations}`).start();

			// Run pre-iteration hook
			await hookExecutor.runPreIteration(iteration);

			// Execute the tool
			let result: ExecutionResult;
			let retried = false;

			try {
				spinner.text = `Iteration ${iteration}/${config.maxIterations} - Running ${toolName}...`;
				spinner.stop();
				console.log(chalk.cyan(`\n━━━ Iteration ${iteration} ━━━\n`));

				result = await adapter.execute(command);
				lastOutput = result.stdout + result.stderr;

				// Handle errors based on strategy
				if (result.exitCode !== 0) {
					if (config.errorHandling.strategy === "retry-once" && !retried) {
						console.log(chalk.yellow(`\nRetrying iteration ${iteration}...`));

						// Run error hook
						await hookExecutor.runOnError(iteration, result.exitCode);

						retried = true;
						result = await adapter.execute(command);
						lastOutput = result.stdout + result.stderr;
					}

					if (result.exitCode !== 0) {
						if (config.errorHandling.strategy === "stop") {
							await hookExecutor.runOnError(iteration, result.exitCode);
							stopReason = `Error on iteration ${iteration} (exit code ${result.exitCode})`;
							break;
						}
						// strategy === "continue" - just log and continue
						console.log(
							chalk.yellow(`\nIteration ${iteration} failed with exit code ${result.exitCode}`),
						);
					}
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.error(chalk.red(`\nExecution error: ${errorMsg}`));
				stopReason = `Execution error: ${errorMsg}`;
				break;
			}

			// Record progress
			const filesChanged = await getFilesChangedCount();
			const diffSummary = await getGitDiffSummary();

			progressWriter.appendIteration({
				iteration,
				timestamp: new Date(),
				status: retried ? "retried" : result.exitCode === 0 ? "completed" : "failed",
				duration: result.duration,
				exitCode: result.exitCode,
				filesChanged,
				diffSummary,
			});

			// Run post-iteration hook
			await hookExecutor.runPostIteration(iteration, result.exitCode);

			// Auto-commit per iteration if enabled
			if (shouldAutoCommit && isGitRepo && config.git.commitStrategy === "per-iteration") {
				await performCommit(iteration, session.name, config.git.commitMessageTemplate, toolName);
			}

			console.log(
				chalk.dim(
					`\n━━━ Iteration ${iteration} complete (${(result.duration / 1000).toFixed(1)}s) ━━━\n`,
				),
			);

			// Check stop conditions
			const stopContext: StopCheckContext = {
				iteration,
				maxIterations: config.maxIterations,
				output: lastOutput,
				workingDir: process.cwd(),
			};

			const stopResult = checkStopConditions(config.stopConditions, stopContext);
			if (stopResult.shouldStop) {
				stopReason = stopResult.reason || "Stop condition met";
				break;
			}

			// Check stop hook
			if (config.stopConditions.hook.enabled && config.stopConditions.hook.command) {
				const hookEnv: Record<string, string> = {
					RL_ITERATION: String(iteration),
					RL_SESSION_NAME: session.name,
					RL_PROMPT_FILE: session.promptFile,
					RL_SESSION_DIR: session.dir,
					RL_EXIT_CODE: String(result.exitCode),
				};

				const hookResult = await runStopHook(config.stopConditions.hook.command, hookEnv);
				if (hookResult.shouldStop) {
					stopReason = hookResult.reason || "Stop hook triggered";
					break;
				}
			}
		}

		// If we exited the loop normally (reached max iterations)
		if (iteration >= config.maxIterations && stopReason === "unknown") {
			stopReason = `Reached max iterations (${config.maxIterations})`;
		}

		// Auto-commit on stop if enabled
		if (shouldAutoCommit && isGitRepo && config.git.commitStrategy === "on-stop") {
			await performCommit(iteration, session.name, config.git.commitMessageTemplate, toolName);
		}

		// Write summary
		progressWriter.writeSummary({
			totalIterations: iteration,
			stopReason,
			totalDuration: progressWriter.getElapsedTime(),
		});

		// Run completion hook
		await hookExecutor.runOnComplete(iteration, stopReason);

		console.log(chalk.green(`\n✓ Session complete: ${stopReason}`));
		console.log(chalk.dim(`  Progress: ${session.progressFile}`));

		return {
			totalIterations: iteration,
			stopReason,
			session,
			success: true,
		};
	} finally {
		// Always clean up combined prompt file
		combinedPrompt.cleanup();
	}
}
