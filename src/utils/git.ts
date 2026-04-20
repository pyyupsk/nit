import { existsSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { dirname, isAbsolute, join, normalize, parse, resolve } from "node:path"

type SafeResult<T> = Promise<[Error, null] | [null, T]>

function invalidGitDirFile(candidate: string): [Error, null] {
  return [new Error(`Invalid gitdir file: ${candidate}`), null]
}

async function resolveGitDir(candidate: string): SafeResult<string> {
  const candidateStat = await stat(candidate)
  if (candidateStat.isDirectory()) return [null, candidate]
  if (!candidateStat.isFile()) {
    return [new Error(`Unsupported .git entry: ${candidate}`), null]
  }

  const raw = await readFile(candidate, "utf8")
  const line = raw.split(/\r?\n/u).find((entry) => entry.startsWith("gitdir:"))

  if (line === undefined) return invalidGitDirFile(candidate)

  const target = line.slice("gitdir:".length).trim()
  if (target.length === 0) return invalidGitDirFile(candidate)

  const gitDir = isAbsolute(target)
    ? normalize(target)
    : resolve(dirname(candidate), target)

  return [null, gitDir]
}

export async function findGitDir(
  startPath: string,
  stopAt?: string,
): SafeResult<string> {
  const startStat = await getStartStat(startPath)
  if (startStat instanceof Error) {
    return [startStat, null]
  }

  let current = startStat.isDirectory() ? startPath : dirname(startPath)
  const { root } = parse(current)

  while (!isTraversalComplete(current, root, stopAt)) {
    const result = await tryResolveGitDir(current)
    if (result) return result

    current = dirname(current)
  }

  return [new Error(`Not a git repository (searched from ${startPath})`), null]
}

async function getStartStat(path: string) {
  try {
    return await stat(path)
  } catch {
    return new Error(`Path does not exist: ${path}`)
  }
}

function isTraversalComplete(
  current: string,
  root: string,
  stopAt?: string,
): boolean {
  if (current === root) return true
  if (stopAt !== undefined && current === stopAt) return true
  if (dirname(current) === current) return true
  return false
}

async function tryResolveGitDir(
  current: string,
): Promise<SafeResult<string> | null> {
  const candidate = join(current, ".git")

  if (!existsSync(candidate)) return null

  try {
    return await resolveGitDir(candidate)
  } catch (error) {
    return [
      error instanceof Error
        ? error
        : new Error(`Failed to resolve git directory from ${candidate}`),
      null,
    ]
  }
}
