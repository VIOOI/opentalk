import { defineConfig, type Options } from "tsup";
import { spawn, ChildProcess } from 'child_process';

export default defineConfig((options) => {
  return {
    entry: ["./src/**/*.(tsx|ts)"], // Исправлено для включения файлов из подпапок
    outDir: "./build/",
    // minify: options.watch ? false : "terser",
    minify: false,
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: "recommended",
    format: ["esm", "cjs"],
    target: "es2020",
    legacyOutput: false,
    onSuccess() {
      const process: ChildProcess = spawn("node", ["./build/index.js"], { stdio: 'inherit' })
      return () => process && process.kill()
    },
		esbuildOptions: (opt, context) => {
      opt.bundle = false;
    },
  };
});
