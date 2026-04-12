# @pyyupsk/nit

Lightweight, zero-dependency Git hooks manager for JavaScript/Node.js projects.

Configure hooks in `package.json` — no extra config files, no dependencies.

## Features

- Zero runtime dependencies
- Config lives in `package.json` under a `"nit"` key
- Auto-installs hooks via the `prepare` lifecycle script
- CI-safe `check` command — exits 1 when hooks are out of sync
- Staged hooks — run commands only on files that match a glob pattern
- Works with any package manager (bun, npm, pnpm, yarn)

## Installation

```sh
bun add -D @pyyupsk/nit
```

Then add a `prepare` script so hooks are installed automatically on `bun install`:

```json
{
  "scripts": {
    "prepare": "nit install"
  }
}
```

## Configuration

Add a `"nit"` key to your `package.json`:

```json
{
  "nit": {
    "hooks": {
      "pre-commit": "bun run lint && bun run typecheck",
      "commit-msg": "bun run test"
    }
  }
}
```

Any valid [Git hook name](https://git-scm.com/docs/githooks) is supported as a key. The value is the shell command to run.

### Staged Hooks

Instead of a plain command string, a hook can be defined as a `stages` object. Each key is a glob pattern and the value is the command to run on the matching staged files. Use `{staged_files}` as a placeholder — nit replaces it with the list of matched files before running the command.

```json
{
  "nit": {
    "hooks": {
      "pre-commit": {
        "stages": {
          "**/*.{ts,js}": "biome check --write {staged_files}",
          "**/*.css": "stylelint --fix {staged_files}"
        }
      }
    }
  }
}
```

Stages only run when at least one staged file matches the pattern. If no files match a stage, that stage is skipped entirely. Commands without `{staged_files}` run as-is (useful for project-wide checks triggered by any staged file).

## CLI

```sh
nit install          # write hooks to .git/hooks/ (default when run bare)
nit sync             # alias for install
nit check            # exit 1 if installed hooks differ from config (CI-safe)
nit exec <hook>      # run the staged hook for <hook> against currently staged files
```

### `nit install` / `nit sync`

Reads `nit.hooks` from `package.json` and writes a shell script for each entry into `.git/hooks/`. Each hook file is made executable automatically.

```sh
$ nit install
nit: installed pre-commit, commit-msg
```

### `nit check`

Compares the installed hook files against the current config without writing anything. Exits with code `1` if any hook is missing or has a different command — useful in CI to enforce that hooks are committed.

```sh
$ nit check
nit: hooks are up to date
```

### `nit exec <hook>`

Runs a staged hook by name against the currently staged files. This is the command that the generated hook script calls internally — you rarely need to run it directly.

```sh
nit exec pre-commit
```

## Self-hosting Example

`nit` manages its own hooks:

```json
{
  "nit": {
    "hooks": {
      "pre-commit": {
        "stages": {
          "**/*.{ts,json}": "biome check --write {staged_files}"
        }
      },
      "pre-push": "bun typecheck && bun test && bun run build"
    }
  }
}
```

## License

MIT
