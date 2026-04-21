import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { checkHooks } from "../../src/core/check"

const TMP = join(import.meta.dirname, "__tmp_check__")
const GIT_HOOKS = join(TMP, ".git", "hooks")

function writeHook(name: string, cmd: string) {
  writeFileSync(join(GIT_HOOKS, name), `#!/bin/sh\n${cmd}\n`, {
    mode: 0o755,
  })
}

beforeEach(() => {
  mkdirSync(GIT_HOOKS, { recursive: true })
})

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
})

describe("checkHooks", () => {
  it("returns in-sync=true when all hooks match config", async () => {
    writeHook("pre-commit", "bun run lint")
    writeHook("commit-msg", "bun run test")

    const [err, inSync] = await checkHooks(
      { "pre-commit": "bun run lint", "commit-msg": "bun run test" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    expect(inSync).toBe(true)
  })

  it("returns in-sync=false when a hook file is missing", async () => {
    writeHook("pre-commit", "bun run lint")
    // commit-msg is NOT written

    const [err, inSync] = await checkHooks(
      { "pre-commit": "bun run lint", "commit-msg": "bun run test" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    expect(inSync).toBe(false)
  })

  it("returns in-sync=false when a hook command differs", async () => {
    writeHook("pre-commit", "bun run old-command")

    const [err, inSync] = await checkHooks(
      { "pre-commit": "bun run lint" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    expect(inSync).toBe(false)
  })

  it("returns in-sync=true for an empty config with no hook files expected", async () => {
    const [err, inSync] = await checkHooks({}, GIT_HOOKS)

    expect(err).toBeNull()
    expect(inSync).toBe(true)
  })

  it("returns an error when the hooks directory does not exist", async () => {
    const [err, inSync] = await checkHooks(
      { "pre-commit": "bun run lint" },
      join(TMP, "nonexistent", "hooks"),
    )

    expect(err).toBeInstanceOf(Error)
    expect(inSync).toBeNull()
  })

  it("returns in-sync=false when hook content has no matching command", async () => {
    // Write a hook that exists but has completely different content
    writeFileSync(join(GIT_HOOKS, "pre-commit"), "#!/bin/bash\necho hello\n", {
      mode: 0o755,
    })

    const [err, inSync] = await checkHooks(
      { "pre-commit": "bun run lint" },
      GIT_HOOKS,
    )

    expect(err).toBeNull()
    expect(inSync).toBe(false)
  })

  it("returns true when a staged hook has the correct nit exec line", async () => {
    const hookName = "pre-commit"
    writeFileSync(
      join(GIT_HOOKS, hookName),
      `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\n./node_modules/.bin/nit exec ${hookName}\n`,
    )
    const [err, inSync] = await checkHooks(
      { [hookName]: { stages: { "*.ts": "eslint {staged_files}" } } },
      GIT_HOOKS,
    )
    expect(err).toBeNull()
    expect(inSync).toBe(true)
  })

  it("returns false when a staged hook is missing the nit exec line", async () => {
    const hookName = "pre-commit"
    writeFileSync(
      join(GIT_HOOKS, hookName),
      `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\neslint --fix\n`,
    )
    const [err, inSync] = await checkHooks(
      { [hookName]: { stages: { "*.ts": "eslint {staged_files}" } } },
      GIT_HOOKS,
    )
    expect(err).toBeNull()
    expect(inSync).toBe(false)
  })

  it("returns true for mixed string and staged hooks both correctly installed", async () => {
    writeFileSync(
      join(GIT_HOOKS, "pre-commit"),
      `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\n./node_modules/.bin/nit exec pre-commit\n`,
    )
    writeFileSync(
      join(GIT_HOOKS, "commit-msg"),
      `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\nbun test\n`,
    )
    const [err, inSync] = await checkHooks(
      {
        "pre-commit": { stages: { "*.ts": "eslint {staged_files}" } },
        "commit-msg": "bun test",
      },
      GIT_HOOKS,
    )
    expect(err).toBeNull()
    expect(inSync).toBe(true)
  })
})
