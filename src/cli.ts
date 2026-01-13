#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { getToolConfig, loadConfig } from "./config/index.js";
import { runLoop } from "./loop/index.js";
import { getAdapter, getAvailableTools } from "./tools/index.js";
import { createCombinedPrompt } from "./utils/prompt.js";

const program = new Command();

program
	.name("rl")
	.description("AI coding loop CLI tool implementing the Ralph method")
	.version("0.1.0");

program
	.argument("[prompt-file]", "Path to the prompt file")
	.option("-mi, --max-iterations <number>", "Maximum loop iterations")
	.option("-t, --tool <tool>", "AI tool to use (claude-code, opencode, cursor, codex)")
	.option("-m, --model <model>", "Model override")
	.option("-n, --name <name>", "Session/feature name")
	.option("-c, --config <path>", "Config file path", "./rl.config.json")
	.option("--no-commit", "Disable auto-commit")
	.option("--dry-run", "Show what would run without executing")
	.option("-v, --verbose", "Verbose output")
	.option("-D, --debug-prompt", "Print the full prompt and exit")
	.action(async (promptFile, options) => {
		if (!promptFile) {
			console.log("Usage: rl <prompt-file> [options]");
			console.log("Run 'rl --help' for more information.");
			process.exit(1);
		}

		try {
			// Load and merge config
			const config = loadConfig({
				configPath: options.config,
				cliOverrides: {
					maxIterations: options.maxIterations
						? Number.parseInt(options.maxIterations, 10)
						: undefined,
					tool: options.tool,
					commit: options.commit,
				},
			});

			const toolName = options.tool || config.defaultTool;
			const toolConfig = getToolConfig(config, toolName);
			const adapter = getAdapter(toolName);
			const model = options.model || toolConfig.model;

			// Build command for display
			const command = await adapter.buildCommand(promptFile, toolConfig, model);

			if (options.verbose || options.dryRun) {
				console.log(chalk.bold("\nConfiguration:"));
				console.log(chalk.dim("─".repeat(40)));
				console.log(`  Tool:           ${chalk.cyan(toolName)}`);
				console.log(`  Model:          ${chalk.cyan(model || "default")}`);
				console.log(`  Max iterations: ${chalk.cyan(config.maxIterations)}`);
				console.log(`  Auto-commit:    ${chalk.cyan(config.git.autoCommit && options.commit)}`);
				console.log(`  Prompt file:    ${chalk.cyan(promptFile)}`);
				console.log(chalk.dim("─".repeat(40)));
				console.log(`  Command:        ${chalk.yellow(command)}`);
				console.log();
			}

			if (options.debugPrompt) {
				const sessionName = options.name || "debug-session";
				const combined = createCombinedPrompt(promptFile, {
					includeSystemPrompt: true,
					sessionName,
				});

				// Read and print the combined prompt
				const { readFileSync } = await import("node:fs");
				const content = readFileSync(combined.filePath, "utf-8");
				console.log(content);

				combined.cleanup();
				return;
			}

			if (options.dryRun) {
				console.log(chalk.yellow("Dry run - no execution"));

				// Check tool availability
				const isAvailable = await adapter.isAvailable();
				if (!isAvailable) {
					console.log(chalk.red(`\n⚠ Warning: '${toolName}' is not installed or not in PATH`));
					const available = await getAvailableTools();
					if (available.length > 0) {
						console.log(chalk.dim(`Available tools: ${available.join(", ")}`));
					}
				} else {
					console.log(chalk.green(`\n✓ Tool '${toolName}' is available`));
				}
				return;
			}

			// Run the loop
			const result = await runLoop({
				promptFile,
				config,
				toolName,
				model,
				sessionName: options.name,
				verbose: options.verbose,
				autoCommit: options.commit,
			});

			if (!result.success) {
				process.exit(1);
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(chalk.red(`Error: ${error.message}`));
			} else {
				console.error(chalk.red("An unexpected error occurred"));
			}
			process.exit(1);
		}
	});

program
	.command("init")
	.description("Initialize rl.config.json for the current project")
	.action(async () => {
		try {
			await runInit();
		} catch (error) {
			if (error instanceof Error) {
				console.error(chalk.red(`Error: ${error.message}`));
			}
			process.exit(1);
		}
	});

program.parse();
