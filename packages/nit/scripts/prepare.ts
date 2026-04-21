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

const localBin = join(root, "node_modules/.bin/nit")
const rootBin = join(root, "../../node_modules/.bin/nit")

link(join(root, "dist/cli.js"), localBin)
link(join(root, "dist/cli.js"), rootBin)

// run nit install from monorepo root so it reads root package.json hooks config
// use bun + dist/cli.js directly to avoid symlink dependency on Windows
const gitRoot = join(root, "../..")
const pathSep = process.platform === "win32" ? ";" : ":"
const nodeBin = join(gitRoot, "node_modules", ".bin")
const install = spawnSync(
  "bun",
  ["run", join(root, "dist/cli.js"), "install"],
  {
    cwd: gitRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${nodeBin}${pathSep}${process.env.PATH ?? ""}`,
    },
  },
)
if (install.status !== 0) process.exit(install.status ?? 1)
