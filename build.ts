import { $ } from "bun";
import { rm } from "node:fs/promises";

console.log("Building Satisfactory-Discord-Bot with Bun...");

// Clean dist directory
await rm(`${import.meta.dirname}/dist`, { recursive: true, force: true });

// Install dependencies in Satisfactory-Discord-Bot
console.log("Installing dependencies...");
await $`npm ci`.cwd(`${import.meta.dirname}/Satisfactory-Discord-Bot`);

// Build single binary using Bun.build API
console.log("Compiling to single binary...");
await Bun.build({
  entrypoints: [`${import.meta.dirname}/Satisfactory-Discord-Bot/bin/server.js`],
  format: "cjs",
  compile: {
    outfile: `${import.meta.dirname}/dist/satisfactory-service`,
    autoloadBunfig: false,
    autoloadPackageJson: false,
    autoloadTsconfig: false,
  },
  bytecode: true,
  minify: {
    keepNames: true,
  },
  target: "bun",
  sourcemap: "inline",
});

console.log("Build completed.");
console.log("Binary: dist/satisfactory-service");

// Only run docker build if not in CI
if (!process.env.CI) {
  console.log("Building Docker image...");
  await $`docker buildx build .`.cwd(import.meta.dirname);
}
