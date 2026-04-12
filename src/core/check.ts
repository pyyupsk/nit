import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import type { HookDef } from "../utils/config"
import { NIT_FINGERPRINT, nitExecCmd } from "./hook-script"

type SafeResult = Promise<[Error, null] | [null, boolean]>

async function checkInstalledHook(
  name: string,
  def: HookDef,
  hooksDir: string,
): SafeResult {
  const hookPath = join(hooksDir, name)
  if (!existsSync(hookPath)) return [null, false]

  let content: string
  try {
    content = await readFile(hookPath, "utf8")
  } catch (e) {
    return [
      e instanceof Error ? e : new Error(`Failed to read hook "${name}"`),
      null,
    ]
  }

  const expectedLine = typeof def === "string" ? def.trim() : nitExecCmd(name)
  const hasCmd = content
    .split("\n")
    .some((line) => line.trim() === expectedLine)
  return [null, hasCmd]
}

async function hasStaleHook(
  hooksDir: string,
  configuredNames: Set<string>,
): Promise<boolean> {
  try {
    const entries = await readdir(hooksDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isFile() || configuredNames.has(e.name)) continue
      try {
        const content = await readFile(join(hooksDir, e.name), "utf8")
        if (content.startsWith(NIT_FINGERPRINT)) return true
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // skip if readdir fails
  }
  return false
}

export async function checkHooks(
  hooks: Record<string, HookDef>,
  hooksDir: string,
): SafeResult {
  try {
    await stat(hooksDir)
  } catch {
    return [new Error(`Hooks directory does not exist: ${hooksDir}`), null]
  }

  for (const [name, def] of Object.entries(hooks)) {
    const [err, ok] = await checkInstalledHook(name, def, hooksDir)
    if (err !== null) return [err, null]
    if (!ok) return [null, false]
  }

  if (await hasStaleHook(hooksDir, new Set(Object.keys(hooks)))) {
    return [null, false]
  }

  return [null, true]
}
