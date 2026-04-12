import { spawn } from "node:child_process"

const STAGED_FILES = "{staged_files}"

function escapeRegex(s: string): string {
  return s.replaceAll(/[.+^$|()[\]\\]/g, String.raw`\$&`)
}

export function globToRegex(pattern: string): RegExp {
  let src = ""
  let i = 0
  while (i < pattern.length) {
    const ch = pattern.charAt(i)
    if (ch === "*" && pattern.charAt(i + 1) === "*") {
      src += ".*"
      i += 2
      if (pattern.charAt(i) === "/") i++
    } else if (ch === "*") {
      src += "[^/]*"
      i++
    } else if (ch === "?") {
      src += "[^/]"
      i++
    } else if (ch === "{") {
      const close = pattern.indexOf("}", i)
      if (close < 0) {
        src += String.raw`\{`
        i++
      } else {
        const alts = pattern
          .slice(i + 1, close)
          .split(",")
          .map(escapeRegex)
          .join("|")
        src += `(?:${alts})`
        i = close + 1
      }
    } else {
      src += escapeRegex(ch)
      i++
    }
  }
  return new RegExp(`^${src}$`)
}

export function matchGlob(filepath: string, pattern: string): boolean {
  const file = filepath.replaceAll("\\", "/")
  const basename = file.split("/").at(-1) ?? file
  const re = globToRegex(pattern)
  return re.test(file) || re.test(basename)
}

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let i = 0
  while (i < command.length) {
    const ch = command.charAt(i)
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < command.length && command.charAt(i) !== quote) {
        current += command.charAt(i)
        i++
      }
      i++
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
      i++
    } else {
      current += ch
      i++
    }
  }
  if (current.length > 0) tokens.push(current)
  return tokens
}

function runCommand(
  command: string,
  files: string[],
  cwd: string,
): Promise<Error | null> {
  return new Promise((resolve) => {
    const args: string[] = []
    for (const part of tokenize(command)) {
      if (part === STAGED_FILES) {
        args.push(...files)
      } else {
        args.push(part)
      }
    }
    const [bin, ...rest] = args
    if (!bin) return resolve(new Error(`Empty command in stage: "${command}"`))
    const child = spawn(bin, rest, { cwd, stdio: "inherit" })
    child.on("close", (code) =>
      resolve(
        code === 0
          ? null
          : new Error(`Command "${command}" exited with code ${code}`),
      ),
    )
    child.on("error", resolve)
  })
}

export function getStagedFiles(
  cwd: string,
): Promise<[Error, null] | [null, string[]]> {
  return new Promise((resolve) => {
    const child = spawn(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    )
    let stdout = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.on("close", () => resolve([null, stdout.split("\n").filter(Boolean)]))
    child.on("error", (e) => resolve([e, null]))
  })
}

export async function execStages(
  stages: Record<string, string>,
  cwd: string,
): Promise<[Error, null] | [null, true]> {
  const [gitErr, stagedFiles] = await getStagedFiles(cwd)
  if (gitErr !== null) return [gitErr, null]

  if (stagedFiles.length === 0) return [null, true]

  // Normalize once per file, not once per (file, pattern) pair
  const normalized = stagedFiles.map((f) => {
    const file = f.replaceAll("\\", "/")
    return { file, basename: file.split("/").at(-1) ?? file }
  })

  for (const [pattern, command] of Object.entries(stages)) {
    // Compile regex once per pattern, not once per (file, pattern) pair
    const re = globToRegex(pattern)
    const matched = normalized
      .filter(({ file, basename }) => re.test(file) || re.test(basename))
      .map(({ file }) => file)
    if (matched.length === 0) continue

    const err = await runCommand(command, matched, cwd)
    if (err !== null) return [err, null]
  }

  return [null, true]
}
