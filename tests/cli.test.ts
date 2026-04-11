import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { run } from "../src/cli"

const TMP = join(import.meta.dirname, "__tmp_cli__")
const GIT_HOOKS = join(TMP, ".git", "hooks")

function writePkg(nit: unknown) {
  writeFileSync(
    join(TMP, "package.json"),
    JSON.stringify({ name: "test-app", nit }),
    "utf8",
  )
}

beforeEach(() => {
  mkdirSync(GIT_HOOKS, { recursive: true })
  writePkg({
    hooks: {
      "pre-commit": "bun run lint",
    },
  })
})

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
})

describe("run (CLI dispatch)", () => {
  it("installs hooks with 'install' command and exits 0", async () => {
    const code = await run(["install"], TMP)

    expect(code).toBe(0)
    expect(existsSync(join(GIT_HOOKS, "pre-commit"))).toBe(true)
  })

  it("installs hooks with 'sync' alias and exits 0", async () => {
    const code = await run(["sync"], TMP)

    expect(code).toBe(0)
    expect(existsSync(join(GIT_HOOKS, "pre-commit"))).toBe(true)
  })

  it("defaults to install when no command is given", async () => {
    const code = await run([], TMP)

    expect(code).toBe(0)
    expect(existsSync(join(GIT_HOOKS, "pre-commit"))).toBe(true)
  })

  it("check command exits 0 when hooks are in sync", async () => {
    await run(["install"], TMP)

    const code = await run(["check"], TMP)

    expect(code).toBe(0)
  })

  it("check command exits 1 when hooks are out of sync", async () => {
    // Don't install — hooks dir is empty
    const code = await run(["check"], TMP)

    expect(code).toBe(1)
  })

  it("exits 1 for an unknown command", async () => {
    const code = await run(["unknown-command"], TMP)

    expect(code).toBe(1)
  })

  it("hook content matches expected script after install", async () => {
    await run(["install"], TMP)

    const content = readFileSync(join(GIT_HOOKS, "pre-commit"), "utf8")
    expect(content).toBe("#!/bin/sh\nbun run lint\n")
  })

  it("exits 0 silently when no .git directory exists (graceful prepare skip)", async () => {
    const noGit = mkdtempSync(join(TMP, "no-git-"))
    writeFileSync(
      join(noGit, "package.json"),
      JSON.stringify({ nit: { hooks: { "pre-commit": "bun run lint" } } }),
      "utf8",
    )

    const code = await run(["install"], noGit)

    expect(code).toBe(0)
  })

  it("check exits 1 with error message when .git/hooks does not exist", async () => {
    rmSync(GIT_HOOKS, { recursive: true })
    const errors: string[] = []
    const logger = { log: () => {}, error: (m: string) => errors.push(m) }

    const code = await run(["check"], TMP, logger)

    expect(code).toBe(1)
    expect(errors.some((m) => m.startsWith("nit:"))).toBe(true)
  })

  it("exits 1 with error message when hook binary is not in PATH", async () => {
    writePkg({ hooks: { "pre-commit": "__nonexistent_binary__" } })
    const errors: string[] = []
    const logger = { log: () => {}, error: (m: string) => errors.push(m) }

    const code = await run(["install"], TMP, logger)

    expect(code).toBe(1)
    expect(errors.some((m) => m.includes("not found"))).toBe(true)
  })

  it("exits 1 with error message when hook cannot be written", async () => {
    // Place a directory at the hook path so writeFile fails
    mkdirSync(join(GIT_HOOKS, "pre-commit"))
    const errors: string[] = []
    const logger = { log: () => {}, error: (m: string) => errors.push(m) }

    const code = await run(["install"], TMP, logger)

    expect(code).toBe(1)
    expect(errors.some((m) => m.startsWith("nit:"))).toBe(true)
  })

  it("logs 'no hooks configured' when hooks object is empty", async () => {
    writePkg({ hooks: {} })
    const logs: string[] = []
    const logger = { log: (m: string) => logs.push(m), error: () => {} }

    const code = await run(["install"], TMP, logger)

    expect(code).toBe(0)
    expect(logs).toContain("nit: no hooks configured")
  })
})
