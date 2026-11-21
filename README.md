# nit

[![NPM version](https://img.shields.io/npm/v/@pyyupsk/nit?label=npm&logo=npm&logoColor=white)](https://www.npmjs.com/package/@pyyupsk/nit)
[![Install size](https://img.shields.io/npm/unpacked-size/@pyyupsk/nit?label=size)](https://www.npmjs.com/package/@pyyupsk/nit)
[![Unit Test](https://github.com/pyyupsk/nit/actions/workflows/unit-test.yml/badge.svg)](https://github.com/pyyupsk/nit/actions/workflows/unit-test.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/github/license/pyyupsk/nit)](https://github.com/pyyupsk/nit/blob/main/LICENSE)

Git hooks from your `package.json`, with no dependencies.

[📝 Changelog](https://github.com/pyyupsk/nit/releases) · [🐛 Issues](https://github.com/pyyupsk/nit/issues)

## Features

- 📦 No runtime dependencies
- 🧾 Hooks live in `package.json` under a `"nit"` key, with no extra files
- 🔁 The `prepare` script installs the hooks on every install
- 🎯 Stages run a command only on the staged files that match a glob
- 🧹 `restage` adds the fixes of a formatter to the commit
- 🧰 Stage commands find tools in `node_modules/.bin`
- ✅ If the installed hooks differ from the config, `nit check` fails CI
- 🌳 Works in git worktrees, and with bun, npm, pnpm and yarn

## Install

```sh
npm install -D @pyyupsk/nit
```

Add a `prepare` script, so that every install writes the hooks:

```json
{
  "scripts": {
    "prepare": "nit install"
  }
}
```

## Usage

```json
{
  "nit": {
    "hooks": {
      "pre-commit": {
        "stages": {
          "**/*.{ts,js}": "oxlint {staged_files}",
          "**/*.css": { "command": "stylelint --fix {staged_files}", "restage": true }
        }
      },
      "pre-push": "npm test"
    }
  }
}
```

The key of a hook is any [Git hook name](https://git-scm.com/docs/githooks). The value is one of two types:

- A string is a shell command. It runs as written.
- A `stages` object maps a glob to a command. If no staged file matches its glob, a stage does not run. nit replaces `{staged_files}` with the matched files.

A stage command that fixes files leaves the fixes in the working tree, so the commit gets the unfixed files. Use `{ "command": "...", "restage": true }` to stage the fixes after the command passes. nit does not restage a partially staged file, and it prints a warning. This keeps your unstaged edits out of the commit.

## CLI

| Command           | Does                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `nit install`     | Writes the hooks to `.git/hooks/`. `nit` alone does the same        |
| `nit sync`        | Same as `nit install`                                               |
| `nit check`       | If an installed hook differs from the config, exits with `1`        |
| `nit exec <hook>` | Runs the stages of `<hook>` on the staged files. Each hook calls it |

## Why?

husky keeps each hook as a file in a `.husky/` folder, and lint-staged is a second package for staged files. nit does both from one `"nit"` key in `package.json`, with no dependencies of its own.

## License

[MIT](https://github.com/pyyupsk/nit/blob/main/LICENSE) License © 2026 [Pongsakorn Thipayanate](https://github.com/pyyupsk)
