import { execFileSync, execSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  execStages,
  getStagedFiles,
  globToRegex,
  matchGlob,
} from "../../src/core/stages"

function initGitRepo(dir: string): void {
  execSync("git init", { cwd: dir })
  execSync('git config user.email "t@t.com"', { cwd: dir })
  execSync('git config user.name "T"', { cwd: dir })
}

describe("globToRegex", () => {
  it("matches exact filenames", () => {
    expect(globToRegex("foo.ts").test("foo.ts")).toBe(true)
    expect(globToRegex("foo.ts").test("bar.ts")).toBe(false)
  })

  it("* matches anything except /", () => {
    const re = globToRegex("*.ts")
    expect(re.test("foo.ts")).toBe(true)
    expect(re.test("src/foo.ts")).toBe(false)
  })

  it("** matches across path segments", () => {
    const re = globToRegex("**/*.ts")
    expect(re.test("src/foo.ts")).toBe(true)
    expect(re.test("src/core/foo.ts")).toBe(true)
    expect(re.test("foo.ts")).toBe(true)
  })

  it("{a,b} matches either alternative", () => {
    const re = globToRegex("*.{ts,tsx}")
    expect(re.test("foo.ts")).toBe(true)
    expect(re.test("foo.tsx")).toBe(true)
    expect(re.test("foo.js")).toBe(false)
  })

  it("? matches a single character", () => {
    const re = globToRegex("foo?.ts")
    expect(re.test("fooA.ts")).toBe(true)
    expect(re.test("foo.ts")).toBe(false)
  })

  it("bare * matches any flat filename", () => {
    expect(globToRegex("*").test("anything")).toBe(true)
    expect(globToRegex("*").test("src/foo.ts")).toBe(false)
  })
})

describe("matchGlob", () => {
  it("matches against full relative path", () => {
    expect(matchGlob("src/foo.ts", "src/*.ts")).toBe(true)
  })

  it("matches against basename when full path does not match", () => {
    expect(matchGlob("src/foo.ts", "*.ts")).toBe(true)
    expect(matchGlob("src/foo.tsx", "*.{ts,tsx}")).toBe(true)
  })

  it("returns false when neither path nor basename matches", () => {
    expect(matchGlob("src/foo.js", "*.ts")).toBe(false)
  })

  it("normalises Windows backslashes", () => {
    expect(matchGlob(String.raw`src\foo.ts`, "*.ts")).toBe(true)
  })
})

describe("getStagedFiles", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "nit-stages-"))
    initGitRepo(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns empty array when nothing is staged", async () => {
    const [err, files] = await getStagedFiles(tmpDir)
    expect(err).toBeNull()
    expect(files).toEqual([])
  })

  it("returns staged file names", async () => {
    writeFileSync(join(tmpDir, "foo.ts"), "const x = 1")
    writeFileSync(join(tmpDir, "bar.ts"), "const y = 2")
    execSync("git add foo.ts bar.ts", { cwd: tmpDir })
    const [err, files] = await getStagedFiles(tmpDir)
    expect(err).toBeNull()
    expect(files).toContain("foo.ts")
    expect(files).toContain("bar.ts")
  })

  it("does not return unstaged files", async () => {
    writeFileSync(join(tmpDir, "staged.ts"), "const x = 1")
    writeFileSync(join(tmpDir, "unstaged.ts"), "const y = 2")
    execSync("git add staged.ts", { cwd: tmpDir })
    const [err, files] = await getStagedFiles(tmpDir)
    expect(err).toBeNull()
    expect(files).toContain("staged.ts")
    expect(files).not.toContain("unstaged.ts")
  })

  it("returns staged file names with spaces without git quoting artifacts", async () => {
    const spaced = "my cool file.ts"
    writeFileSync(join(tmpDir, spaced), "const x = 1")
    execFileSync("git", ["add", "--", spaced], { cwd: tmpDir })

    const [err, files] = await getStagedFiles(tmpDir)

    expect(err).toBeNull()
    expect(files).toContain(spaced)
    expect(files).not.toContain(`"${spaced}"`)
  })
})

describe("execStages", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "nit-exec-"))
    initGitRepo(tmpDir)
    writeFileSync(join(tmpDir, "foo.ts"), "const x = 1")
    writeFileSync(join(tmpDir, "bar.md"), "# hello")
    execSync("git add foo.ts bar.md", { cwd: tmpDir })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns [null, true] when no staged files exist", async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "nit-empty-"))
    try {
      initGitRepo(emptyDir)
      const [err, result] = await execStages(
        { "*.ts": "node --version" },
        emptyDir,
      )
      expect(err).toBeNull()
      expect(result).toBe(true)
    } finally {
      rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it("skips a stage when no staged files match its pattern", async () => {
    const [err, result] = await execStages(
      { "*.css": "node --version" },
      tmpDir,
    )
    expect(err).toBeNull()
    expect(result).toBe(true)
  })

  it("runs the command when files match and no {staged_files} placeholder", async () => {
    const [err, result] = await execStages({ "*.ts": "node --version" }, tmpDir)
    expect(err).toBeNull()
    expect(result).toBe(true)
  })

  it("injects matched staged files at {staged_files}", async () => {
    const scriptFile = join(tmpDir, "capture.cjs")
    const argsFile = join(tmpDir, "args.txt")
    writeFileSync(
      scriptFile,
      String.raw`const fs=require('fs'); fs.writeFileSync(process.argv[2], process.argv.slice(3).join('\n'))`,
    )
    const [err, result] = await execStages(
      { "*.ts": `node ${scriptFile} ${argsFile} {staged_files}` },
      tmpDir,
    )
    expect(err).toBeNull()
    expect(result).toBe(true)
    const captured = readFileSync(argsFile, "utf8")
    expect(captured).toContain("foo.ts")
    expect(captured).not.toContain("bar.md")
  })

  it("returns error when a stage command exits non-zero", async () => {
    const [err] = await execStages(
      { "*.ts": `node -e "process.exit(1)"` },
      tmpDir,
    )
    expect(err).toBeInstanceOf(Error)
  })

  it("stops at the first failing stage and does not run subsequent stages", async () => {
    const touchFile = join(tmpDir, "reached.txt")
    const [err] = await execStages(
      {
        "*.ts": `node -e "process.exit(1)"`,
        "*.md": `node -e "require('fs').writeFileSync('${touchFile}','ok')"`,
      },
      tmpDir,
    )
    expect(err).toBeInstanceOf(Error)
    expect(() => readFileSync(touchFile, "utf8")).toThrow()
  })

  it("supports shell operators in stage commands", async () => {
    const outputFile = join(tmpDir, "shell.txt")
    const okScript = join(tmpDir, "ok.cjs")
    const writeScript = join(tmpDir, "write.cjs")
    writeFileSync(okScript, "process.stdout.write('ok')")
    writeFileSync(
      writeScript,
      `require('fs').writeFileSync(${JSON.stringify(outputFile)}, 'done')`,
    )

    const [err, result] = await execStages(
      { "*.ts": `node ${okScript} && node ${writeScript}` },
      tmpDir,
    )

    expect(err).toBeNull()
    expect(result).toBe(true)
    expect(readFileSync(outputFile, "utf8")).toBe("done")
  })

  it("passes staged files with spaces through {staged_files}", async () => {
    const spaced = "my cool file.ts"
    const scriptFile = join(tmpDir, "capture-space.cjs")
    const argsFile = join(tmpDir, "space-args.txt")

    writeFileSync(join(tmpDir, spaced), "const spaced = true")
    execFileSync("git", ["add", "--", spaced], { cwd: tmpDir })
    writeFileSync(
      scriptFile,
      "const fs=require('fs'); fs.writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)))",
    )

    const [err, result] = await execStages(
      { "*.ts": `node ${scriptFile} ${argsFile} {staged_files}` },
      tmpDir,
    )

    expect(err).toBeNull()
    expect(result).toBe(true)
    expect(JSON.parse(readFileSync(argsFile, "utf8"))).toContain(spaced)
  })
})
