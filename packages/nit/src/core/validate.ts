import { existsSync } from "node:fs"
import { delimiter, join } from "node:path"
import type { HookDef } from "../utils/config"
import { localBinDir } from "./stages"

function commandExists(bin: string, dirs: string[]): boolean {
  const exts =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""]
  return dirs.some((dir) =>
    exts.some((ext) => existsSync(join(dir, bin + ext))),
  )
}

function validateCommand(
  hookName: string,
  cmd: string,
  dirs: string[],
): Error | null {
  const bin = cmd.trim().split(/\s+/).at(0)
  if (bin === undefined || bin === "") {
    return new Error(`Hook "${hookName}" has an empty command`)
  }
  if (!commandExists(bin, dirs)) {
    return new Error(`Hook "${hookName}": command "${bin}" not found in PATH`)
  }
  return null
}

export function validateHooks(
  hooks: Record<string, HookDef>,
  cwd = process.cwd(),
): Error | null {
  const pathDirs = (process.env.PATH ?? "").split(delimiter)
  const stageDirs = [localBinDir(cwd), ...pathDirs]
  for (const [hookName, def] of Object.entries(hooks)) {
    if (typeof def === "string") {
      const err = validateCommand(hookName, def, pathDirs)
      if (err !== null) return err
    } else {
      for (const [pattern, cmd] of Object.entries(def.stages)) {
        const err = validateCommand(`${hookName}[${pattern}]`, cmd, stageDirs)
        if (err !== null) return err
      }
    }
  }
  return null
}
