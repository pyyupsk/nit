import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { readConfig } from "../../src/utils/config"

const TMP = join(import.meta.dirname, "__tmp_config__")

function writePkg(content: unknown) {
  writeFileSync(join(TMP, "package.json"), JSON.stringify(content), "utf8")
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
})

describe("readConfig", () => {
  it("reads nit.hooks from package.json", async () => {
    writePkg({
      name: "my-app",
      nit: {
        hooks: {
          "pre-commit": "bun run lint",
          "commit-msg": "bun run test",
        },
      },
    })

    const [err, config] = await readConfig(TMP)

    expect(err).toBeNull()
    expect(config).toEqual({
      hooks: {
        "pre-commit": "bun run lint",
        "commit-msg": "bun run test",
      },
    })
  })

  it("returns an error when package.json is missing", async () => {
    const [err, config] = await readConfig(TMP)

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toMatch(/package\.json/i)
    expect(config).toBeNull()
  })

  it("returns empty hooks when nit key is absent", async () => {
    writePkg({ name: "no-nit-key" })

    const [err, config] = await readConfig(TMP)

    expect(err).toBeNull()
    expect(config).toEqual({ hooks: {} })
  })

  it("returns empty hooks when nit.hooks is absent", async () => {
    writePkg({ name: "partial", nit: {} })

    const [err, config] = await readConfig(TMP)

    expect(err).toBeNull()
    expect(config).toEqual({ hooks: {} })
  })

  it("returns an error when package.json contains invalid JSON", async () => {
    writeFileSync(join(TMP, "package.json"), "{ not valid json", "utf8")

    const [err, config] = await readConfig(TMP)

    expect(err).toBeInstanceOf(Error)
    expect(config).toBeNull()
  })

  it("returns an error when nit.hooks is not a plain object", async () => {
    writePkg({ nit: { hooks: "bun run lint" } })

    const [err, config] = await readConfig(TMP)

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toMatch(/hooks must be an object/i)
    expect(config).toBeNull()
  })

  it("returns an error when a hook value is not a string", async () => {
    writePkg({ nit: { hooks: { "pre-commit": 42 } } })

    const [err, config] = await readConfig(TMP)

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toMatch(/pre-commit/)
    expect(config).toBeNull()
  })

  it("parses a hook with stages", async () => {
    const pkgPath = join(TMP, "package.json")
    const tmpDir = TMP
    writeFileSync(
      pkgPath,
      JSON.stringify({
        nit: {
          hooks: {
            "pre-commit": {
              stages: {
                "*.ts": "eslint --fix {staged_files}",
                "*.md": "prettier --write {staged_files}",
              },
            },
          },
        },
      }),
    )
    const [err, config] = await readConfig(tmpDir)
    expect(err).toBeNull()
    expect(config?.hooks["pre-commit"]).toEqual({
      stages: {
        "*.ts": "eslint --fix {staged_files}",
        "*.md": "prettier --write {staged_files}",
      },
    })
  })

  it("parses mixed string and staged hooks", async () => {
    const pkgPath = join(TMP, "package.json")
    const tmpDir = TMP
    writeFileSync(
      pkgPath,
      JSON.stringify({
        nit: {
          hooks: {
            "pre-commit": { stages: { "*.ts": "eslint {staged_files}" } },
            "commit-msg": "bun test",
          },
        },
      }),
    )
    const [err, config] = await readConfig(tmpDir)
    expect(err).toBeNull()
    expect(typeof config?.hooks["commit-msg"]).toBe("string")
    expect(config?.hooks["pre-commit"]).toHaveProperty("stages")
  })

  it("returns error when stages value is not an object", async () => {
    const pkgPath = join(TMP, "package.json")
    const tmpDir = TMP
    writeFileSync(
      pkgPath,
      JSON.stringify({
        nit: { hooks: { "pre-commit": { stages: "bad" } } },
      }),
    )
    const [err] = await readConfig(tmpDir)
    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toContain("stages")
  })

  it("returns error when a stage command is not a string", async () => {
    const pkgPath = join(TMP, "package.json")
    const tmpDir = TMP
    writeFileSync(
      pkgPath,
      JSON.stringify({
        nit: { hooks: { "pre-commit": { stages: { "*.ts": 42 } } } },
      }),
    )
    const [err] = await readConfig(tmpDir)
    expect(err).toBeInstanceOf(Error)
  })

  it("returns error when hook value is not a string or stages object", async () => {
    const pkgPath = join(TMP, "package.json")
    const tmpDir = TMP
    writeFileSync(
      pkgPath,
      JSON.stringify({ nit: { hooks: { "pre-commit": 123 } } }),
    )
    const [err] = await readConfig(tmpDir)
    expect(err).toBeInstanceOf(Error)
  })
})
