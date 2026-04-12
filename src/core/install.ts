import {
  chmod,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"
import type { HookDef } from "../utils/config"
import { hookScript, NIT_FINGERPRINT } from "./hook-script"

type SafeResult = Promise<[Error, null] | [null, true]>

export async function installHooks(
  hooks: Record<string, HookDef>,
  hooksDir: string,
): SafeResult {
  try {
    await stat(hooksDir)
  } catch {
    return [new Error(`Hooks directory does not exist: ${hooksDir}`), null]
  }

  const written: string[] = []

  for (const [name, hookDef] of Object.entries(hooks)) {
    const hookPath = join(hooksDir, name)
    try {
      await writeFile(hookPath, hookScript(hookDef, name), "utf8")
      written.push(hookPath)
      await chmod(hookPath, 0o755)
    } catch (e) {
      await Promise.all(written.map((p) => unlink(p).catch(() => {})))
      return [
        e instanceof Error ? e : new Error(`Failed to write hook "${name}"`),
        null,
      ]
    }
  }

  // Prune stale nit-owned hooks
  try {
    const entries = await readdir(hooksDir, { withFileTypes: true })
    const configuredNames = new Set(Object.keys(hooks))
    await Promise.all(
      entries
        .filter((e) => e.isFile() && !configuredNames.has(e.name))
        .map(async (e) => {
          const hookPath = join(hooksDir, e.name)
          try {
            const content = await readFile(hookPath, "utf8")
            if (content.startsWith(NIT_FINGERPRINT)) {
              await unlink(hookPath)
            }
          } catch {
            // non-fatal: skip files we can't read or delete
          }
        }),
    )
  } catch {
    // non-fatal: if readdir fails, skip pruning
  }

  return [null, true]
}
