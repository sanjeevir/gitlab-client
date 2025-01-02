import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import treeShaking from "rollup-plugin-tree-shakeable";

export default {
  input: "src/index.js",
  output: [
    {
      dir: "dist",
      format: "cjs",
      sourcemap: true,
    },
    {
      dir: "dist",
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({ preferBuiltins: false }),
    commonjs(),
    json(),
    babel({ babelHelpers: "bundled", exclude: "node_modules/**" }),
    terser(),
    treeShaking(),
  ],
  external: ["node-fetch", "fs", "path", "punycode"],
};
