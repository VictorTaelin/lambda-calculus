#!/usr/bin/env bun
import { readFileSync } from "fs";
import { parse, snf, show, Ref, App, Term, Stats, to_bin, from_bin, check_affine } from "./lam";

var flags = new Set<string>();
var positional: string[] = [];
for (var arg of process.argv.slice(2)) {
  if (arg[0] === "-") {
    flags.add(arg);
  } else {
    positional.push(arg);
  }
}

var input = positional[0];
if (!input) {
  console.error("Usage: lam <file.lam|bits> [args...] [-s] [--to-bin|--from-bin|--affine]");
  process.exit(1);
}

if (flags.has("--from-bin")) {
  var bits = input.endsWith(".bin") ? readFileSync(input, "utf-8").trim() : input;
  process.stdout.write(from_bin(bits));
  process.exit(0);
}

var code = input.endsWith(".lam") ? readFileSync(input, "utf-8") : input;
var stripped = code.replace(/\/\/[^\n]*/g, "").trimStart();
var book = parse(stripped[0] === "@" ? code : "@main = " + code);

if (flags.has("--to-bin")) {
  console.log(to_bin(book));
  process.exit(0);
}

if (flags.has("--affine")) {
  var errs = check_affine(book);
  if (errs.length === 0) {
    console.log("✓ all definitions are affine");
  } else {
    for (var err of errs) {
      console.log("✗ " + err);
    }
    process.exit(1);
  }
  process.exit(0);
}

var keys = Object.keys(book);
var entry = keys[keys.length - 1];
var term: Term = Ref(entry);
for (var ext of positional.slice(1)) {
  term = App(term, parse("@_ = " + ext)["_"]);
}
var stats: Stats = { beta: 0 };
var t0 = performance.now();
var result = snf(book, term, stats);
var dt = (performance.now() - t0) / 1000;
console.log(show(result));
if (flags.has("-s")) {
  console.log("- beta: " + stats.beta);
  console.log("- time: " + dt.toFixed(3) + " seconds");
  console.log("- perf: " + Math.round(stats.beta / dt) + " betas/s");
}
