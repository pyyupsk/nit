import {
  chmod,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"

const NIT_FINGERPRINT = '#!/bin/sh\nif [ "$SKIP_NIT"'

type SafeResult = Promise<[Error, null] | [null, true]>

function hookScript(cmd: string): string {
  return `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\n${cmd}\n`
}

export async function installHooks(
  hooks: Record<string, string>,
  hooksDir: string,
): SafeResult {
  try {
    await stat(hooksDir)
  } catch {
    return [new Error(`Hooks directory does not exist: ${hooksDir}`), null]
  }

  const written: string[] = []

  for (const [name, cmd] of Object.entries(hooks)) {
    const hookPath = join(hooksDir, name)
    try {
      await writeFile(hookPath, hookScript(cmd), "utf8")
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
    const entries = await readdir(hooksDir)
    const configuredNames = new Set(Object.keys(hooks))
    await Promise.all(
      entries
        .filter((entry) => !configuredNames.has(entry))
        .map(async (entry) => {
          const hookPath = join(hooksDir, entry)
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
