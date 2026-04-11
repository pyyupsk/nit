#!/usr/bin/env node
import { join } from "node:path"
import { checkHooks } from "./core/check"
import { installHooks } from "./core/install"
import { validateHooks } from "./core/validate"
import { readConfig } from "./utils/config"
import { findGitDir } from "./utils/git"

type Logger = {
  log: (msg: string) => void
  error: (msg: string) => void
}

const silent: Logger = { log: () => {}, error: () => {} }

export async function run(
  args: string[],
  cwd: string,
  logger: Logger = silent,
): Promise<number> {
  const command = args.at(0) ?? "install"

  if (!["install", "sync", "check"].includes(command)) {
    logger.error(`nit: unknown command "${command}"`)
    logger.error("Usage: nit [install|sync|check]")
    return 1
  }

  const [cfgErr, config] = await readConfig(cwd)
  if (cfgErr !== null) {
    logger.error(`nit: ${cfgErr.message}`)
    return 1
  }

  const [gitErr, gitDir] = await findGitDir(cwd)
  if (gitErr !== null) {
    logger.error(`nit: ${gitErr.message}`)
    return 1
  }

  const hooksDir = join(gitDir, "hooks")

  if (command === "check") {
    const [err, inSync] = await checkHooks(config.hooks, hooksDir)
    if (err !== null) {
      logger.error(`nit: ${err.message}`)
      return 1
    }
    if (!inSync) {
      logger.error("nit: hooks are out of sync — run \`nit install\` to fix")
      return 1
    }
    logger.log("nit: hooks are up to date")
    return 0
  }

  // install / sync
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
  if (hookNames.length === 0) {
    logger.log("nit: no hooks configured")
  } else {
    logger.log(`nit: installed ${hookNames.join(", ")}`)
  }
  return 0
}

// Run when invoked directly as a binary
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"))

if (isMain) {
  const args = process.argv.slice(2)
  run(args, process.cwd(), console).then((code) => {
    process.exit(code)
  })
}
