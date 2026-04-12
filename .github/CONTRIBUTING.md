# Contributing to @pyyupsk/nit

Thank you for your interest in contributing! This document covers how to get started.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.x
- Node.js >= 20

### Setup

```sh
git clone https://github.com/pyyupsk/nit.git
cd nit
bun install
```

Hooks are installed automatically via the `prepare` script.

### Development

```sh
bun run dev        # watch mode
bun run build      # one-off build
bun test           # run tests
bun run typecheck  # type-check without emitting
bun run check      # lint + format check
```

## Making Changes

1. Fork the repository and create a branch from `main`.
2. Branch names should reflect content: `feat/staged-hooks`, `fix/ci-exit-code`.
3. Write or update tests for any behaviour change.
4. Run `bun test && bun run typecheck` before pushing.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org):

```text
feat: add support for post-merge hook
fix: resolve exit code on Windows
chore: update dependencies
docs: clarify staged hooks example
```

Common types: `feat` · `fix` · `chore` · `refactor` · `docs` · `style` · `test` · `perf`

## Pull Requests

- Target the `main` branch.
- Keep PRs focused — one logical change per PR.
- Fill in the pull request template.
- All CI checks must pass before merge.

## Reporting Issues

Use the issue templates provided in this repository. For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## Code Style

This project uses [Biome](https://biomejs.dev) for linting and formatting. Run `bun run check` to verify before submitting.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
