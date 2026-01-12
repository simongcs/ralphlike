import chalk from "chalk";
import inquirer from "inquirer";
import { DEFAULT_CONFIG } from "../config/defaults.js";
import { configExists, writeConfig } from "../config/loader.js";
import type { Config, ToolName } from "../config/schema.js";
import { getAllToolNames, getAvailableTools } from "../tools/index.js";

interface InitAnswers {
	defaultTool: ToolName;
	maxIterations: number;
	enableDoneFile: boolean;
	autoCommit: boolean;
	commitStrategy?: "per-iteration" | "on-stop";
	errorStrategy: "stop" | "retry-once" | "continue";
}

export async function runInit(): Promise<void> {
	console.log(chalk.bold("\n🔧 Initializing rl configuration\n"));

	if (configExists()) {
		const { overwrite } = await inquirer.prompt([
			{
				type: "confirm",
				name: "overwrite",
				message: "rl.config.json already exists. Overwrite?",
				default: false,
			},
		]);

		if (!overwrite) {
			console.log(chalk.yellow("Aborted."));
			return;
		}
	}

	// Detect available tools
	console.log(chalk.dim("Detecting available tools..."));
	const availableTools = await getAvailableTools();
	const allTools = getAllToolNames();

	if (availableTools.length > 0) {
		console.log(chalk.green(`Found: ${availableTools.join(", ")}`));
	} else {
		console.log(chalk.yellow("No tools detected. You can still configure them manually."));
	}

	const answers = await inquirer.prompt<InitAnswers>([
		{
			type: "list",
			name: "defaultTool",
			message: "Default AI tool:",
			choices: allTools.map((tool) => ({
				name: availableTools.includes(tool) ? `${tool} (installed)` : `${tool} (not found)`,
				value: tool,
			})),
			default: availableTools[0] || "claude-code",
		},
		{
			type: "number",
			name: "maxIterations",
			message: "Default max iterations:",
			default: 10,
			validate: (input: number) =>
				input >= 1 && input <= 1000 ? true : "Must be between 1 and 1000",
		},
		{
			type: "confirm",
			name: "enableDoneFile",
			message: "Enable done-file stop condition? (creates DONE.md to stop)",
			default: false,
		},
		{
			type: "confirm",
			name: "autoCommit",
			message: "Enable auto-commit after iterations?",
			default: false,
		},
		{
			type: "list",
			name: "commitStrategy",
			message: "Commit strategy:",
			choices: [
				{ name: "After each iteration", value: "per-iteration" },
				{ name: "Only when session stops", value: "on-stop" },
			],
			default: "per-iteration",
			when: (answers: { autoCommit: boolean }) => answers.autoCommit,
		},
		{
			type: "list",
			name: "errorStrategy",
			message: "Error handling strategy:",
			choices: [
				{ name: "Retry once, then stop (recommended)", value: "retry-once" },
				{ name: "Stop immediately", value: "stop" },
				{ name: "Continue to next iteration", value: "continue" },
			],
			default: "retry-once",
		},
	]);

	const config: Config = {
		...DEFAULT_CONFIG,
		defaultTool: answers.defaultTool,
		maxIterations: answers.maxIterations,
		stopConditions: {
			...DEFAULT_CONFIG.stopConditions,
			doneFile: {
				enabled: answers.enableDoneFile,
				path: "DONE.md",
			},
		},
		git: {
			...DEFAULT_CONFIG.git,
			autoCommit: answers.autoCommit,
			commitStrategy: answers.commitStrategy || "per-iteration",
		},
		errorHandling: {
			...DEFAULT_CONFIG.errorHandling,
			strategy: answers.errorStrategy,
		},
	};

	writeConfig(config, "./rl.config.json");

	console.log(chalk.green("\n✓ Created rl.config.json"));
	console.log(chalk.dim("\nRun 'rl <prompt-file>' to start a session."));
}
