import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type NitConfig = {
  hooks: Record<string, string>;
};

type SafeResult<T> = Promise<[Error, null] | [null, T]>;

export async function readConfig(cwd: string): SafeResult<NitConfig> {
  const pkgPath = join(cwd, "package.json");

  let raw: string;
  try {
    raw = await readFile(pkgPath, "utf8");
  } catch {
    return [new Error(`Cannot find package.json at ${pkgPath}`), null];
  }

  let pkg: unknown;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return [
      new Error(`package.json contains invalid JSON at ${pkgPath}`),
      null,
    ];
  }

  if (typeof pkg !== "object" || pkg === null) {
    return [new Error("package.json must be a JSON object"), null];
  }

  const nit = (pkg as Record<string, unknown>)["nit"];

  if (nit === undefined) {
    return [null, { hooks: {} }];
  }

  if (typeof nit !== "object" || nit === null) {
    return [new Error('"nit" in package.json must be an object'), null];
  }

  const nitObj = nit as Record<string, unknown>;
  const hooks = nitObj["hooks"];

  if (hooks === undefined) {
    return [null, { hooks: {} }];
  }

  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) {
    return [new Error("hooks must be an object in nit config"), null];
  }

  const hooksObj = hooks as Record<string, unknown>;
  for (const [name, cmd] of Object.entries(hooksObj)) {
    if (typeof cmd !== "string") {
      return [
        new Error(
          `Hook "${name}" must have a string command, got ${typeof cmd}`
        ),
        null,
      ];
    }
  }

  return [null, { hooks: hooksObj as Record<string, string> }];
}
