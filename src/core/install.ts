import { chmod, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

type SafeResult = Promise<[Error, null] | [null, true]>

function hookScript(cmd: string): string {
  return `#!/bin/sh\n${cmd}\n`
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

  for (const [name, cmd] of Object.entries(hooks)) {
    const hookPath = join(hooksDir, name)
    try {
      await writeFile(hookPath, hookScript(cmd), "utf8")
      await chmod(hookPath, 0o755)
    } catch (e) {
      return [
        e instanceof Error ? e : new Error(`Failed to write hook "${name}"`),
        null,
      ]
    }
  }

  return [null, true]
}
