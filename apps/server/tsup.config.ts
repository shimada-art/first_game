import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // Workspace packages have no build step of their own (consumed as raw TS
  // source by dev tooling), so inline them into the server bundle rather
  // than leaving an unresolvable import for plain `node` to choke on.
  noExternal: ["@souk/shared"],
});
