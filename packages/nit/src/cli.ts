#!/usr/bin/env node
import { join } from "node:path"
import { checkHooks } from "./core/check"
import { installHooks } from "./core/install"
import { execStages } from "./core/stages"
import { validateHooks } from "./core/validate"
import { type NitConfig, readConfig } from "./utils/config"
import { findGitDir } from "./utils/git"

type Logger = {
  log: (msg: string) => void
  error: (msg: string) => void
}

const silent: Logger = { log: () => {}, error: () => {} }

async function runExec(
  args: string[],
  config: NitConfig,
  cwd: string,
  logger: Logger,
): Promise<number> {
  const hookName = args.at(1)
  if (!hookName) {
    logger.error("nit: exec requires a hook name")
    return 1
  }
  const hookDef = config.hooks[hookName]
  if (hookDef === undefined || typeof hookDef === "string") {
    logger.error(`nit: "${hookName}" is not a staged hook`)
    return 1
  }
  const [err] = await execStages(hookDef.stages, cwd)
  if (err !== null) {
    logger.error(`nit: ${err.message}`)
    return 1
  }
  return 0
}

async function runCheck(
  config: NitConfig,
  hooksDir: string,
  logger: Logger,
): Promise<number> {
  const [err, inSync] = await checkHooks(config.hooks, hooksDir)
  if (err !== null) {
    logger.error(`nit: ${err.message}`)
    return 1
  }
  if (!inSync) {
    logger.error("nit: hooks are out of sync — run `nit install` to fix")
    return 1
  }
  logger.log("nit: hooks are up to date")
  return 0
}

async function runInstall(
  config: NitConfig,
  hooksDir: string,
  logger: Logger,
): Promise<number> {
  const validErr = validateHooks(config.hooks)
  if (validErr !== null) {
    logger.error(`nit: ${validErr.message}`)
    return 1
  }
  const [installErr] = await installHooks(config.hooks, hooksDir)
  if (installErr !== null) {
    logger.error(`nit: ${installErr.message}`)
    return 1
  }
  const hookNames = Object.keys(config.hooks)
  logger.log(
    hookNames.length === 0
      ? "nit: no hooks configured"
      : `nit: installed ${hookNames.join(", ")}`,
  )
  return 0
}

export async function run(
  args: string[],
  cwd: string,
  logger: Logger = silent,
): Promise<number> {
  const command = args.at(0) ?? "install"

  if (!["install", "sync", "check", "exec"].includes(command)) {
    logger.error(`nit: unknown command "${command}"`)
    logger.error("Usage: nit [install|sync|check|exec]")
    return 1
  }

  const [cfgErr, config] = await readConfig(cwd)
  if (cfgErr !== null) {
    logger.error(`nit: ${cfgErr.message}`)
    return 1
  }

  if (command === "exec") return runExec(args, config, cwd, logger)

  const [gitErr, gitDir] = await findGitDir(cwd)
  if (gitErr !== null) {
    if (command !== "check") return 0
    logger.error(`nit: ${gitErr.message}`)
    return 1
  }

  const hooksDir = join(gitDir, "hooks")

  if (command === "check") return runCheck(config, hooksDir, logger)

  return runInstall(config, hooksDir, logger)
}

// Run when invoked directly as a binary (cli.js/cli.ts dev, or as `nit` bin)
const isMain =
  typeof process !== "undefined" &&
  /[/\\](?:cli\.[jt]s|nit)$/.test(process.argv[1] ?? "")

if (isMain) {
  const args = process.argv.slice(2)
  const code = await run(args, process.cwd(), console)
  process.exit(code)
}
