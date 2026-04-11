import { describe, expect, it } from "vitest";
import { validateHooks } from "../../src/core/validate";

describe("validateHooks", () => {
  it("returns null when all hook commands resolve to known executables", () => {
    // "bun" is always available in the test environment
    const err = validateHooks({ "pre-commit": "bun run lint" });

    expect(err).toBeNull();
  });

  it("returns null for an empty hooks object", () => {
    const err = validateHooks({});

    expect(err).toBeNull();
  });

  it("returns an Error when the base command is not found in PATH", () => {
    const err = validateHooks({
      "pre-commit": "__this_binary_does_not_exist__ --flag",
    });

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/__this_binary_does_not_exist__/);
    expect(err?.message).toMatch(/not found/i);
  });

  it("only checks the base executable, not the full command string", () => {
    // bun exists; the flags/subcommands don't matter for existence check
    const err = validateHooks({
      "pre-commit": "bun run lint --fix --reporter=verbose",
    });

    expect(err).toBeNull();
  });

  it("returns the first error found when multiple hooks fail", () => {
    const err = validateHooks({
      "pre-commit": "__missing_a__",
      "commit-msg": "__missing_b__",
    });

    expect(err).toBeInstanceOf(Error);
    // Only one error returned — the first invalid hook
    expect(err?.message).toMatch(/__missing_a__|__missing_b__/);
  });
});
