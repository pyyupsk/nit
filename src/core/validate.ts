import { execFileSync } from "node:child_process"

function commandExists(bin: string): boolean {
  try {
    execFileSync("which", [bin], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
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
