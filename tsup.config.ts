import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  shims: true,
});
