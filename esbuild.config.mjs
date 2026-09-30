import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "node:module";

const banner = `/*
Evra: worldbuilding timelines for Obsidian.
This is a generated file. The source lives at https://github.com/fyresmith/evra
*/
`;
const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

if (prod) { await context.rebuild(); process.exit(0); }
else { await context.watch(); }
