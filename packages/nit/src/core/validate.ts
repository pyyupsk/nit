import { existsSync } from "node:fs"
import { join } from "node:path"
import type { HookDef } from "../utils/config"

function commandExists(bin: string): boolean {
  const sep = process.platform === "win32" ? ";" : ":"
  const exts =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""]
  const dirs = (process.env.PATH ?? "").split(sep)
  return dirs.some((dir) =>
    exts.some((ext) => existsSync(join(dir, bin + ext))),
  )
}

function validateCommand(hookName: string, cmd: string): Error | null {
  const bin = cmd.trim().split(/\s+/).at(0)
  if (bin === undefined || bin === "") {
    return new Error(`Hook "${hookName}" has an empty command`)
  }
  if (!commandExists(bin)) {
    return new Error(`Hook "${hookName}": command "${bin}" not found in PATH`)
  }
  return null
}

export function validateHooks(hooks: Record<string, HookDef>): Error | null {
  for (const [hookName, def] of Object.entries(hooks)) {
    if (typeof def === "string") {
      const err = validateCommand(hookName, def)
      if (err !== null) return err
    } else {
      for (const [pattern, cmd] of Object.entries(def.stages)) {
        const err = validateCommand(`${hookName}[${pattern}]`, cmd)
        if (err !== null) return err
      }
    }
  }
  return null
}
