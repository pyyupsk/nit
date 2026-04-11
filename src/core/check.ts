import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"

const NIT_FINGERPRINT = '#!/bin/sh\nif [ "$SKIP_NIT"'

type SafeResult = Promise<[Error, null] | [null, boolean]>

export async function checkHooks(
  hooks: Record<string, string>,
  hooksDir: string,
): SafeResult {
  try {
    await stat(hooksDir)
  } catch {
    return [new Error(`Hooks directory does not exist: ${hooksDir}`), null]
  }

  // Check every configured hook is installed with the correct content
  for (const [name, cmd] of Object.entries(hooks)) {
    const hookPath = join(hooksDir, name)
    if (!existsSync(hookPath)) {
      return [null, false]
    }

    let content: string
    try {
      content = await readFile(hookPath, "utf8")
    } catch (e) {
      return [
        e instanceof Error ? e : new Error(`Failed to read hook "${name}"`),
        null,
      ]
    }

    const lines = content.split("\n")
    const hasCmd = lines.some((line) => line.trim() === cmd.trim())
    if (!hasCmd) {
      return [null, false]
    }
  }

  // Check for stale nit-owned hooks not in config
  try {
    const entries = await readdir(hooksDir, { withFileTypes: true })
    const configuredNames = new Set(Object.keys(hooks))
    for (const e of entries) {
      if (!e.isFile() || configuredNames.has(e.name)) continue
      const hookPath = join(hooksDir, e.name)
      try {
        const content = await readFile(hookPath, "utf8")
        if (content.startsWith(NIT_FINGERPRINT)) {
          return [null, false]
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // skip if readdir fails
  }

  return [null, true]
}
