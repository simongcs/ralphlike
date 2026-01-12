import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG } from "./defaults.js";
import { type Config, ConfigSchema } from "./schema.js";

export interface LoadConfigOptions {
	configPath?: string;
	cliOverrides?: Partial<{
		maxIterations: number;
		tool: string;
		model: string;
		commit: boolean;
	}>;
}

export function loadConfig(options: LoadConfigOptions = {}): Config {
	const configPath = options.configPath || "./rl.config.json";
	const absolutePath = resolve(process.cwd(), configPath);

	let fileConfig: Partial<Config> = {};

	if (existsSync(absolutePath)) {
		try {
			const content = readFileSync(absolutePath, "utf-8");
			fileConfig = JSON.parse(content);
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new Error(`Invalid JSON in config file: ${absolutePath}`);
			}
			throw error;
		}
	}

	// Merge: defaults <- file config <- CLI overrides
	const merged = {
		...DEFAULT_CONFIG,
		...fileConfig,
		tools: {
			...DEFAULT_CONFIG.tools,
			...fileConfig.tools,
		},
		stopConditions: {
			...DEFAULT_CONFIG.stopConditions,
			...fileConfig.stopConditions,
		},
		hooks: {
			...DEFAULT_CONFIG.hooks,
			...fileConfig.hooks,
		},
		errorHandling: {
			...DEFAULT_CONFIG.errorHandling,
			...fileConfig.errorHandling,
		},
		git: {
			...DEFAULT_CONFIG.git,
			...fileConfig.git,
		},
		session: {
			...DEFAULT_CONFIG.session,
			...fileConfig.session,
		},
	};

	// Apply CLI overrides
	if (options.cliOverrides) {
		if (options.cliOverrides.maxIterations !== undefined) {
			merged.maxIterations = options.cliOverrides.maxIterations;
		}
		if (options.cliOverrides.tool !== undefined) {
			merged.defaultTool = options.cliOverrides.tool as Config["defaultTool"];
		}
		if (options.cliOverrides.commit === false) {
			merged.git.autoCommit = false;
		}
	}

	// Validate with Zod
	const result = ConfigSchema.safeParse(merged);
	if (!result.success) {
		const errors = result.error.errors
			.map((e) => `  - ${e.path.join(".")}: ${e.message}`)
			.join("\n");
		throw new Error(`Invalid configuration:\n${errors}`);
	}

	return result.data;
}

export function writeConfig(config: Config, path: string): void {
	const absolutePath = resolve(process.cwd(), path);
	writeFileSync(absolutePath, JSON.stringify(config, null, "\t"), "utf-8");
}

export function configExists(path = "./rl.config.json"): boolean {
	return existsSync(resolve(process.cwd(), path));
}
