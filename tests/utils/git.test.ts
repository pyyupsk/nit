import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findGitDir } from "../../src/utils/git";

const TMP = join(import.meta.dirname, "__tmp_git__");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
});

describe("findGitDir", () => {
  it("finds .git/ at the given root", async () => {
    mkdirSync(join(TMP, ".git"));

    const [err, gitDir] = await findGitDir(TMP);

    expect(err).toBeNull();
    expect(gitDir).toBe(join(TMP, ".git"));
  });

  it("finds .git/ in a parent directory", async () => {
    mkdirSync(join(TMP, ".git"));
    const nested = join(TMP, "packages", "ui", "src");
    mkdirSync(nested, { recursive: true });

    const [err, gitDir] = await findGitDir(nested);

    expect(err).toBeNull();
    expect(gitDir).toBe(join(TMP, ".git"));
  });

  it("returns an error when no .git/ is found within the bounded search", async () => {
    // TMP has no .git — pass a deeply nested dir inside it.
    // Use stopAt=TMP so traversal doesn't escape into the real project .git.
    const deep = join(TMP, "a", "b", "c");
    mkdirSync(deep, { recursive: true });

    const [err, gitDir] = await findGitDir(deep, TMP);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/not a git repository/i);
    expect(gitDir).toBeNull();
  });

  it("returns an error when the start path does not exist", async () => {
    const nonExistent = join(TMP, "does-not-exist");

    const [err, gitDir] = await findGitDir(nonExistent);

    expect(err).toBeInstanceOf(Error);
    expect(gitDir).toBeNull();
  });
});
