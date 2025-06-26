import { build } from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

await build({
  entryPoints: ["src/content.ts"],
  bundle: true,
  outfile: "dist/content.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    NodeModulesPolyfillPlugin(),
    NodeGlobalsPolyfillPlugin({
      process: true,
      buffer: true,
    }),
  ],
  inject: ["./node-polyfill.js"],
  banner: {
    js: "(() => {",
  },
  footer: {
    js: "})();",
  },
}).catch(() => process.exit(1));
