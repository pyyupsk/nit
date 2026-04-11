import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

type SafeResult = Promise<[Error, null] | [null, boolean]>;

export async function checkHooks(
  hooks: Record<string, string>,
  hooksDir: string
): SafeResult {
  try {
    await stat(hooksDir);
  } catch {
    return [new Error(`Hooks directory does not exist: ${hooksDir}`), null];
  }

  for (const [name, cmd] of Object.entries(hooks)) {
    const hookPath = join(hooksDir, name);
    if (!existsSync(hookPath)) {
      return [null, false];
    }

    let content: string;
    try {
      content = await readFile(hookPath, "utf8");
    } catch (e) {
      return [
        e instanceof Error ? e : new Error(`Failed to read hook "${name}"`),
        null,
      ];
    }

    // The installed hook must contain the configured command as a line
    const lines = content.split("\n");
    const hasCmd = lines.some((line) => line.trim() === cmd.trim());
    if (!hasCmd) {
      return [null, false];
    }
  }

  return [null, true];
}
