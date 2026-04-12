import { readFile } from "node:fs/promises"
import { join } from "node:path"

export type StageDef = Record<string, string>
export type HookDef = string | { stages: StageDef }
export type NitConfig = { hooks: Record<string, HookDef> }

type SafeResult<T> = Promise<[Error, null] | [null, T]>

function parseHookValue(
  name: string,
  value: unknown,
): [Error, null] | [null, HookDef] {
  if (typeof value === "string") {
    return [null, value]
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.hasOwn(value as Record<string, unknown>, "stages")
  ) {
    const stages = (value as Record<string, unknown>).stages

    if (
      typeof stages !== "object" ||
      stages === null ||
      Array.isArray(stages)
    ) {
      return [
        new Error(
          `Hook "${name}" has invalid stages: stages must be a plain object`,
        ),
        null,
      ]
    }

    const stagesObj = stages as Record<string, unknown>
    for (const [pattern, cmd] of Object.entries(stagesObj)) {
      if (typeof cmd !== "string") {
        return [
          new Error(
            `Hook "${name}" stage "${pattern}" must have a string command, got ${typeof cmd}`,
          ),
          null,
        ]
      }
    }

    return [null, { stages: stagesObj as StageDef }]
  }

  return [
    new Error(
      `Hook "${name}" must be a string or a stages object, got ${typeof value}`,
    ),
    null,
  ]
}

export async function readConfig(cwd: string): SafeResult<NitConfig> {
  const pkgPath = join(cwd, "package.json")

  let raw: string
  try {
    raw = await readFile(pkgPath, "utf8")
  } catch {
    return [new Error(`Cannot find package.json at ${pkgPath}`), null]
  }

  let pkg: unknown
  try {
    pkg = JSON.parse(raw)
  } catch {
    return [new Error(`package.json contains invalid JSON at ${pkgPath}`), null]
  }

  if (typeof pkg !== "object" || pkg === null) {
    return [new Error("package.json must be a JSON object"), null]
  }

  const nit = (pkg as Record<string, unknown>).nit

  if (nit === undefined) {
    return [null, { hooks: {} }]
  }

  if (typeof nit !== "object" || nit === null) {
    return [new Error('"nit" in package.json must be an object'), null]
  }

  const nitObj = nit as Record<string, unknown>
  const hooks = nitObj.hooks

  if (hooks === undefined) {
    return [null, { hooks: {} }]
  }

  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) {
    return [new Error("hooks must be an object in nit config"), null]
  }

  const hooksObj = hooks as Record<string, unknown>
  const parsedHooks: Record<string, HookDef> = {}

  for (const [name, value] of Object.entries(hooksObj)) {
    const [err, hookDef] = parseHookValue(name, value)
    if (err !== null) {
      return [err, null]
    }
    parsedHooks[name] = hookDef
  }

  return [null, { hooks: parsedHooks }]
}
