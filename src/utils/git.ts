import { existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import { dirname, join, parse } from "node:path"

type SafeResult<T> = Promise<[Error, null] | [null, T]>

export async function findGitDir(
  startPath: string,
  stopAt?: string,
): SafeResult<string> {
  try {
    await stat(startPath)
  } catch {
    return [new Error(`Path does not exist: ${startPath}`), null]
  }

  let current = startPath
  const { root } = parse(current)

  while (current !== root) {
    const candidate = join(current, ".git")
    if (existsSync(candidate)) {
      return [null, candidate]
    }
    if (stopAt !== undefined && current === stopAt) break
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  return [new Error(`Not a git repository (searched from ${startPath})`), null]
}
