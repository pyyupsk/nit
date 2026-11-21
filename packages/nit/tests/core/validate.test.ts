import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { validateHooks } from "../../src/core/validate"

describe("validateHooks", () => {
  it("returns null when all hook commands resolve to known executables", () => {
    // "bun" is always available in the test environment
    const err = validateHooks({ "pre-commit": "bun run lint" })

    expect(err).toBeNull()
  })

  it("returns null for an empty hooks object", () => {
    const err = validateHooks({})

    expect(err).toBeNull()
  })

  it("returns an Error when the base command is not found in PATH", () => {
    const err = validateHooks({
      "pre-commit": "__this_binary_does_not_exist__ --flag",
    })

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toMatch(/__this_binary_does_not_exist__/)
    expect(err?.message).toMatch(/not found/i)
  })

  it("only checks the base executable, not the full command string", () => {
    // bun exists; the flags/subcommands don't matter for existence check
    const err = validateHooks({
      "pre-commit": "bun run lint --fix --reporter=verbose",
    })

    expect(err).toBeNull()
  })

  it("returns an Error when a hook command is blank after trimming", () => {
    const err = validateHooks({ "pre-commit": "   " })

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toMatch(/empty command/i)
  })

  it("returns the first error found when multiple hooks fail", () => {
    const err = validateHooks({
      "pre-commit": "__missing_a__",
      "commit-msg": "__missing_b__",
    })

    expect(err).toBeInstanceOf(Error)
    // Only one error returned — the first invalid hook
    expect(err?.message).toMatch(/__missing_a__|__missing_b__/)
  })

  it("returns null when all stage commands exist in PATH", () => {
    const result = validateHooks({
      "pre-commit": {
        stages: {
          "*.ts": "node --version",
          "*.md": 'node -e "{}"',
        },
      },
    })
    expect(result).toBeNull()
  })

  it("finds stage commands in <cwd>/node_modules/.bin", () => {
    const cwd = mkdtempSync(join(tmpdir(), "nit-validate-"))
    const bin = join(cwd, "node_modules", ".bin")
    mkdirSync(bin, { recursive: true })
    writeFileSync(join(bin, "local-tool-xyz.cmd"), "")
    writeFileSync(join(bin, "local-tool-xyz"), "")

    const stageErr = validateHooks(
      { "pre-commit": { stages: { "*.ts": "local-tool-xyz" } } },
      cwd,
    )
    const plainErr = validateHooks({ "pre-push": "local-tool-xyz" }, cwd)
    rmSync(cwd, { recursive: true, force: true })

    expect(stageErr).toBeNull()
    expect(plainErr).toBeInstanceOf(Error)
  })

  it("validates the command of a stage object", () => {
    const ok = validateHooks({
      "pre-commit": {
        stages: { "*.ts": { command: "node -v", restage: true } },
      },
    })
    const bad = validateHooks({
      "pre-commit": { stages: { "*.ts": { command: "nonexistent-xyz-tool" } } },
    })
    expect(ok).toBeNull()
    expect(bad?.message).toContain("nonexistent-xyz-tool")
  })

  it("returns error when a stage command binary is not in PATH", () => {
    const result = validateHooks({
      "pre-commit": {
        stages: {
          "*.ts": "nonexistent-tool-xyz-abc --flag",
        },
      },
    })
    expect(result).toBeInstanceOf(Error)
    expect(result?.message).toContain("pre-commit[*.ts]")
    expect(result?.message).toContain("nonexistent-tool-xyz-abc")
  })

  it("returns error when a stage command is empty", () => {
    const result = validateHooks({
      "pre-commit": { stages: { "*.ts": "   " } },
    })
    expect(result).toBeInstanceOf(Error)
    expect(result?.message).toContain("pre-commit[*.ts]")
  })

  it("validates mixed string and staged hooks", () => {
    const result = validateHooks({
      "pre-commit": { stages: { "*.ts": "node --version" } },
      "commit-msg": "node --version",
    })
    expect(result).toBeNull()
  })
})
