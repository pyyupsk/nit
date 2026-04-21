import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const build = spawnSync("bun", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
})
if (build.status !== 0) process.exit(build.status ?? 1)

// symlink bin
function link(target: string, dest: string) {
  mkdirSync(join(dest, ".."), { recursive: true })
  if (existsSync(dest)) unlinkSync(dest)
  try {
    symlinkSync(target, dest)
  } catch {
    // non-fatal: root node_modules/.bin/ may not exist yet on fresh install
  }
}

link(join(root, "dist/cli.js"), join(root, "node_modules/.bin/nit"))
link(join(root, "dist/cli.js"), join(root, "../../node_modules/.bin/nit"))
