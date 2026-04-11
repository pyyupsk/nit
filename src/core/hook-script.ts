export const NIT_FINGERPRINT = '#!/bin/sh\nif [ "$SKIP_NIT"'

export function hookScript(cmd: string): string {
  return `#!/bin/sh\nif [ "$SKIP_NIT" = "1" ]; then\n  exit 0\nfi\n${cmd}\n`
}
