# @pyyupsk/nit

Lightweight, zero-dependency Git hooks manager for JavaScript/Node.js projects.

Configure hooks in `package.json` — no extra config files, no dependencies.

## Features

- Zero runtime dependencies
- Config lives in `package.json` under a `"nit"` key
- Auto-installs hooks via the `prepare` lifecycle script
- CI-safe `check` command — exits 1 when hooks are out of sync
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

## CLI

```sh
nit install   # write hooks to .git/hooks/ (default when run bare)
nit sync      # alias for install
nit check     # exit 1 if installed hooks differ from config (CI-safe)
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

## Self-hosting Example

`nit` manages its own hooks:

```json
{
  "nit": {
    "hooks": {
      "pre-commit": "bun format && bun check && bun typecheck && bun test && bun run build"
    }
  }
}
```

## License

MIT
