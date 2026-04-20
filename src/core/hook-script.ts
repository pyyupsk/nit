import type { HookDef } from "../utils/config"

export const SKIP_NIT_HEADER = '#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n'

export function nitExecCmd(hookName: string): string {
  return `./node_modules/.bin/nit exec ${hookName}`
}

export function hookScript(hookDef: HookDef, hookName: string): string {
  const cmd = typeof hookDef === "string" ? hookDef : nitExecCmd(hookName)
  return `${SKIP_NIT_HEADER}  exit 0\nfi\n${cmd}\n`
}
