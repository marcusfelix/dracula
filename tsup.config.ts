import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      types: "src/types.ts",
      config: "src/config.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    clean: true,
    treeshake: true,
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    clean: false,
  },
]);
