import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import css from "rollup-plugin-css-only";

export default {
  input: "src/main.ts",
  output: {
    dir: "dist",
    format: "cjs",
    sourcemap: true,
    exports: "default"
  },
  plugins: [
    nodeResolve({ browser: true }),
    commonjs(),
    css({ output: "styles.css" }),
    typescript()
  ],
  external: ["obsidian", "electron", "@codemirror/state", "@codemirror/view"]
};
