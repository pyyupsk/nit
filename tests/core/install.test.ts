import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installHooks } from "../../src/core/install"

const TMP = join(import.meta.dirname, "__tmp_install__")
const GIT_HOOKS = join(TMP, ".git", "hooks")

beforeEach(() => {
  mkdirSync(GIT_HOOKS, { recursive: true })
})

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
})

describe("installHooks", () => {
  it("writes a hook script for each entry", async () => {
    const [err] = await installHooks(
      { "pre-commit": "bun run lint", "commit-msg": "bun run test" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    expect(existsSync(join(GIT_HOOKS, "pre-commit"))).toBe(true)
    expect(existsSync(join(GIT_HOOKS, "commit-msg"))).toBe(true)
  })

  it("hook script starts with a shebang and contains the command", async () => {
    const [err] = await installHooks(
      { "pre-commit": "bun run lint" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    const content = readFileSync(join(GIT_HOOKS, "pre-commit"), "utf8")
    expect(content).toMatch(/^#!\/bin\/sh\n/)
    expect(content).toContain("bun run lint")
  })

  it("makes hook files executable (owner execute bit)", async () => {
    const [err] = await installHooks(
      { "pre-commit": "bun run lint" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    const mode = statSync(join(GIT_HOOKS, "pre-commit")).mode
    // eslint-disable-next-line no-bitwise
    expect(mode & 0o100).toBeTruthy()
  })

  it("returns null error for an empty hooks object", async () => {
    const [err] = await installHooks({}, GIT_HOOKS)

    expect(err).toBeNull()
  })

  it("returns an error when the hooks directory does not exist", async () => {
    const [err] = await installHooks(
      { "pre-commit": "bun run lint" },
      join(TMP, "nonexistent", "hooks"),
    )

    expect(err).toBeInstanceOf(Error)
  })

  it("rolls back written hooks when a later write fails", async () => {
    // Place a directory at the second hook path — writeFile on a directory fails
    mkdirSync(join(GIT_HOOKS, "commit-msg"))

    const [err] = await installHooks(
      { "pre-commit": "bun run lint", "commit-msg": "bun run test" },
      GIT_HOOKS,
    )

    expect(err).toBeInstanceOf(Error)
    // First hook must be rolled back
    expect(existsSync(join(GIT_HOOKS, "pre-commit"))).toBe(false)
  })

  it("overwrites an existing hook file", async () => {
    await installHooks({ "pre-commit": "bun run old" }, GIT_HOOKS)
    const [err] = await installHooks({ "pre-commit": "bun run new" }, GIT_HOOKS)

    expect(err).toBeNull()
    const content = readFileSync(join(GIT_HOOKS, "pre-commit"), "utf8")
    expect(content).toContain("bun run new")
    expect(content).not.toContain("bun run old")
  })
})
