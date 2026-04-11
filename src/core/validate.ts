import { existsSync } from "node:fs"
import { join } from "node:path"

function commandExists(bin: string): boolean {
  const sep = process.platform === "win32" ? ";" : ":"
  const exts =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""]
  const dirs = (process.env.PATH ?? "").split(sep)
  return dirs.some((dir) =>
    exts.some((ext) => existsSync(join(dir, bin + ext))),
  )
}

export function validateHooks(hooks: Record<string, string>): Error | null {
  for (const [hookName, cmd] of Object.entries(hooks)) {
    const bin = cmd.trim().split(/\s+/).at(0)
    if (bin === undefined || bin === "") {
      return new Error(`Hook "${hookName}" has an empty command`)
    }
    if (!commandExists(bin)) {
      return new Error(`Hook "${hookName}": command "${bin}" not found in PATH`)
    }
  }
  return null
}
