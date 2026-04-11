#!/usr/bin/env node
import { join } from "node:path";
import { checkHooks } from "./core/check";
import { installHooks } from "./core/install";
import { validateHooks } from "./core/validate";
import { readConfig } from "./utils/config";
import { findGitDir } from "./utils/git";

export async function run(args: string[], cwd: string): Promise<number> {
  const command = args.at(0) ?? "install";

  if (!["install", "sync", "check"].includes(command)) {
    console.error(`nit: unknown command "${command}"`);
    console.error("Usage: nit [install|sync|check]");
    return 1;
  }

  const [cfgErr, config] = await readConfig(cwd);
  if (cfgErr !== null) {
    console.error(`nit: ${cfgErr.message}`);
    return 1;
  }

  const [gitErr, gitDir] = await findGitDir(cwd);
  if (gitErr !== null) {
    console.error(`nit: ${gitErr.message}`);
    return 1;
  }

  const hooksDir = join(gitDir, "hooks");

  if (command === "check") {
    const [err, inSync] = await checkHooks(config.hooks, hooksDir);
    if (err !== null) {
      console.error(`nit: ${err.message}`);
      return 1;
    }
    if (!inSync) {
      console.error("nit: hooks are out of sync — run `nit install` to fix");
      return 1;
    }
    console.log("nit: hooks are up to date");
    return 0;
  }

  // install / sync
  const validErr = validateHooks(config.hooks);
  if (validErr !== null) {
    console.error(`nit: ${validErr.message}`);
    return 1;
  }

  const [installErr] = await installHooks(config.hooks, hooksDir);
  if (installErr !== null) {
    console.error(`nit: ${installErr.message}`);
    return 1;
  }

  const hookNames = Object.keys(config.hooks);
  if (hookNames.length === 0) {
    console.log("nit: no hooks configured");
  } else {
    console.log(`nit: installed ${hookNames.join(", ")}`);
  }
  return 0;
}

// Run when invoked directly as a binary
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"));

if (isMain) {
  const args = process.argv.slice(2);
  run(args, process.cwd()).then((code) => {
    process.exit(code);
  });
}
