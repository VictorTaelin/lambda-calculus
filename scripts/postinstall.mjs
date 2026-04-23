import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ghc = spawnSync("ghc", ["--version"], { stdio: "ignore" });

if (ghc.status !== 0) {
  console.warn("lambda-calculus: ghc not found; lam defaults to lam-ts");
  process.exit(0);
}

mkdirSync("bin", { recursive: true });
mkdirSync(".build/hs", { recursive: true });

const result = spawnSync("ghc", [
  "-O2",
  "-outputdir", ".build/hs",
  "-hidir", ".build/hs",
  "hs/cli.hs",
  "hs/lam.hs",
  "-o", "bin/lam-hs-bin",
], { stdio: "inherit" });

if (result.status !== 0) {
  console.warn("lambda-calculus: Haskell build failed; lam defaults to lam-ts");
  process.exit(0);
}

console.warn("lambda-calculus: installed lam-hs; lam defaults to lam-hs");
