import type { HookDef } from "../utils/config"

export const NIT_FINGERPRINT = '#!/bin/sh\nif [ "$SKIP_NIT"'

export function nitExecCmd(hookName: string): string {
  return `./node_modules/.bin/nit exec ${hookName}`
}

export function hookScript(hookDef: HookDef, hookName: string): string {
  const cmd = typeof hookDef === "string" ? hookDef : nitExecCmd(hookName)
  return `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\n${cmd}\n`
}
