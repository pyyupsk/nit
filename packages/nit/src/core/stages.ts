import { spawn } from "node:child_process"
import { delimiter, join } from "node:path"
import type { StageDef } from "../utils/config"

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

function shellEscape(value: string): string {
  if (process.platform === "win32") {
    return `"${value
      .replaceAll("^", "^^")
      .replaceAll("&", "^&")
      .replaceAll("|", "^|")
      .replaceAll("<", "^<")
      .replaceAll(">", "^>")
      .replaceAll("(", "^(")
      .replaceAll(")", "^)")
      .replaceAll("%", "%%")
      .replaceAll("!", "^!")}"`
  }

  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

function expandCommand(command: string, files: string[]): string {
  if (!command.includes(STAGED_FILES)) return command
  const escapedFiles = files.map(shellEscape).join(" ")
  return command.replaceAll(STAGED_FILES, escapedFiles)
}

export function localBinDir(cwd: string): string {
  return join(cwd, "node_modules", ".bin")
}

function runCommand(
  command: string,
  files: string[],
  cwd: string,
): Promise<Error | null> {
  return new Promise((resolve) => {
    const expandedCommand = expandCommand(command, files)
    if (expandedCommand.trim().length === 0) {
      return resolve(new Error(`Empty command in stage: "${command}"`))
    }

    // Windows names it "Path"; a second "PATH" key in the spread env breaks lookup
    const pathKey =
      process.platform === "win32"
        ? (Object.keys(process.env).find((k) => k.toUpperCase() === "PATH") ??
          "Path")
        : "PATH"
    const child = spawn(expandedCommand, {
      cwd,
      env: {
        ...process.env,
        [pathKey]: `${localBinDir(cwd)}${delimiter}${process.env[pathKey] ?? ""}`,
      },
      shell: true,
      stdio: "inherit",
    })
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
      ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    )
    const stdout: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk)
    })
    child.on("close", () =>
      resolve([
        null,
        Buffer.concat(stdout).toString("utf8").split("\0").filter(Boolean),
      ]),
    )
    child.on("error", (e) => resolve([e, null]))
  })
}

function gitFiles(
  args: string[],
  cwd: string,
): Promise<[Error, null] | [null, string[]]> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "inherit"],
    })
    const stdout: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk)
    })
    child.on("close", (code) =>
      resolve(
        code === 0
          ? [
              null,
              Buffer.concat(stdout)
                .toString("utf8")
                .split("\0")
                .filter(Boolean),
            ]
          : [new Error(`git ${args[0]} exited with code ${code}`), null],
      ),
    )
    child.on("error", (e) => resolve([e, null]))
  })
}

const unstagedFiles = (files: string[], cwd: string) =>
  gitFiles(["diff", "--name-only", "-z", "--", ...files], cwd)

export async function execStages(
  stages: StageDef,
  cwd: string,
  warn: (msg: string) => void = () => {},
): Promise<[Error, null] | [null, true]> {
  const [gitErr, stagedFiles] = await getStagedFiles(cwd)
  if (gitErr !== null) return [gitErr, null]

  if (stagedFiles.length === 0) return [null, true]

  // Normalize once per file, not once per (file, pattern) pair
  const normalized = stagedFiles.map((f) => {
    const file = f.replaceAll("\\", "/")
    return { file, basename: file.split("/").at(-1) ?? file }
  })

  for (const [pattern, stage] of Object.entries(stages)) {
    const command = typeof stage === "string" ? stage : stage.command
    const restage = typeof stage !== "string" && stage.restage === true
    // Compile regex once per pattern, not once per (file, pattern) pair
    const re = globToRegex(pattern)
    const matched = normalized
      .filter(({ file, basename }) => re.test(file) || re.test(basename))
      .map(({ file }) => file)
    if (matched.length === 0) continue

    // Restaging a partially staged file would commit edits the user did not stage
    const [beforeErr, partial] = restage
      ? await unstagedFiles(matched, cwd)
      : [null, []]
    if (beforeErr !== null) return [beforeErr, null]

    const err = await runCommand(command, matched, cwd)
    if (err !== null) return [err, null]
    if (!restage) continue

    const [afterErr, changed] = await unstagedFiles(matched, cwd)
    if (afterErr !== null) return [afterErr, null]
    const skipped = changed.filter((f) => partial.includes(f))
    const fixed = changed.filter((f) => !partial.includes(f))
    if (skipped.length > 0) {
      warn(`nit: not restaging partially staged files: ${skipped.join(", ")}`)
    }
    if (fixed.length > 0) {
      const [addErr] = await gitFiles(["add", "--", ...fixed], cwd)
      if (addErr !== null) return [addErr, null]
    }
  }

  return [null, true]
}
