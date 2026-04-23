#!/usr/bin/env bun
import { readFileSync } from "fs";
import { parse, snf, show, Ref, Stats, to_bin, from_bin, check_affine } from "./lam";

var args = process.argv.slice(2);
var show_stats = args.includes("-s");
var do_to_bin = args.includes("--to-bin");
var do_from_bin = args.includes("--from-bin");
var do_affine = args.includes("--affine");
args = args.filter(a => a[0] !== "-");

var input = args[0];
if (!input) {
  console.error("Usage: lam [-s] [--to-bin|--from-bin] <file.lam|bits> [entry]");
  process.exit(1);
}

if (do_from_bin) {
  process.stdout.write(from_bin(input));
  process.exit(0);
}

var code = input.endsWith(".lam") ? readFileSync(input, "utf-8") : input;
var book = parse(code);

if (do_to_bin) {
  console.log(to_bin(book));
  process.exit(0);
}

if (do_affine) {
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
var entry = args[1] || keys[keys.length - 1];
var stats: Stats = { beta: 0 };
var t0 = performance.now();
var result = snf(book, Ref(entry), stats);
var dt = (performance.now() - t0) / 1000;
console.log(show(result));
if (show_stats) {
  console.log("- beta: " + stats.beta);
  console.log("- time: " + dt.toFixed(3) + " seconds");
  console.log("- perf: " + Math.round(stats.beta / dt) + " betas/s");
}
