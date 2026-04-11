import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm", "cjs"],
  clean: true,
  shims: true,
})
