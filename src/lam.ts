export type Term
  = { $: "Var"; name: string }
  | { $: "Ref"; name: string }
  | { $: "Lam"; name: string; body: (x: Term) => Term }
  | { $: "App"; func: Term; argm: Term };

export type Book = { [name: string]: Term };
export type Stats = { beta: number };

export function Var(name: string): Term {
  return { $: "Var", name };
}

export function Ref(name: string): Term {
  return { $: "Ref", name };
}

export function Lam(name: string, body: (x: Term) => Term): Term {
  return { $: "Lam", name, body };
}

export function App(func: Term, argm: Term): Term {
  return { $: "App", func, argm };
}

// Names

export function name_of(n: number): string {
  if (n < 26) {
    return String.fromCharCode(97 + n);
  }
  return name_of(Math.floor(n / 26) - 1) + String.fromCharCode(97 + n % 26);
}

// Show

type Unapplied = { fun: Term; args: Term[] };

function unapp(term: Term): Unapplied {
  if (term.$ !== "App") {
    return { fun: term, args: [] };
  }
  var sp = unapp(term.func);
  return { fun: sp.fun, args: [...sp.args, term.argm] };
}

function show_head(term: Term, d: number): string {
  if (term.$ === "Lam") {
    return "(" + show_go(term, d) + ")";
  }
  return show_go(term, d);
}

function show_lam(term: Term & { $: "Lam" }, d: number): string {
  var name = name_of(d);
  return "λ" + name + "." + show_go(term.body(Var(name)), d + 1);
}

function show_app(term: Term & { $: "App" }, d: number): string {
  var sp = unapp(term);
  return show_head(sp.fun, d) + "(" + sp.args.map(a => show_go(a, d)).join(", ") + ")";
}

function show_go(term: Term, d: number): string {
  switch (term.$) {
    case "Var": return term.name;
    case "Ref": return "@" + term.name;
    case "Lam": return show_lam(term, d);
    case "App": return show_app(term, d);
  }
}

export function show(term: Term): string {
  return show_go(term, 0);
}

// Parse

type Bind = [string, Term];
type P = (ctx: Bind[]) => Term;

export function parse(code: string): Book {
  var i = 0;

  function skip() {
    while (i < code.length) {
      if (code[i] === '/' && code[i+1] === '/') {
        while (i < code.length && code[i] !== '\n') i++;
      } else if (/[ \n]/.test(code[i])) {
        i++;
      } else {
        break;
      }
    }
  }

  function parse_char(c: string) {
    if (code[i++] !== c) throw "Expected '" + c + "'";
  }

  function parse_name(): string {
    var s = "";
    while (i < code.length && /[0-9A-Za-z_]/.test(code[i])) s += code[i++];
    return s;
  }

  function parse_calls(fn: P): P {
    if (code[i] !== "(") {
      return fn;
    }
    i++;
    var args: P[] = [];
    while (true) {
      skip();
      if (code[i] === ")") {
        i++;
        break;
      }
      if (args.length > 0) {
        parse_char(",");
      }
      args.push(parse_term());
    }
    return parse_calls(ctx => args.reduce((f, a) => App(f, a(ctx)), fn(ctx)));
  }

  function parse_term(): P {
    skip();
    switch (code[i]) {
      case "λ": {
        i++;
        var n = parse_name();
        parse_char(".");
        var body = parse_term();
        return ctx => Lam(n, x => body([[n, x], ...ctx]));
      }
      case "@": {
        i++;
        var n = parse_name();
        return parse_calls(_ => Ref(n));
      }
      case "(": {
        i++;
        var inner = parse_term();
        parse_char(")");
        return parse_calls(inner);
      }
      default: {
        var n = parse_name();
        return parse_calls(ctx => ctx.find(b => b[0] === n)![1]);
      }
    }
  }

  var book: Book = {};
  while (true) {
    skip();
    if (i >= code.length) {
      break;
    }
    parse_char("@");
    var n = parse_name();
    skip();
    parse_char("=");
    book[n] = parse_term()([]);
    skip();
  }
  return book;
}

// Binary

function nat_to_bin(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("Invalid natural number: " + n);
  }
  return "1".repeat(n) + "0";
}

function bits_per_ref(defs: string[]): number {
  return Math.ceil(Math.log2(Math.max(defs.length, 1)));
}

function index_to_bits(index: number, width: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= 2 ** width) {
    throw new Error("Invalid global reference index: " + index);
  }
  return index.toString(2).padStart(width, "0");
}

function bits_to_index(bits: string, pos: { i: number }, width: number): number {
  if (width === 0) return 0;
  var end = pos.i + width;
  if (end > bits.length) throw new Error("Invalid binary");
  var chunk = bits.slice(pos.i, end);
  if (!/^[01]+$/.test(chunk)) throw new Error("Invalid binary");
  pos.i = end;
  return parseInt(chunk, 2);
}

function term_to_bin(term: Term, d: number, defs: string[]): string {
  switch (term.$) {
    case "Var": return "10" + nat_to_bin(d - parseInt(term.name.slice(1)) - 1);
    case "Ref": return "11" + ref_to_bin(term.name, defs);
    case "Lam": return "00" + term_to_bin(term.body(Var("$" + d)), d + 1, defs);
    case "App": return "01" + bin_func(term, d, defs) + bin_argm(term, d, defs);
  }
}

function ref_to_bin(name: string, defs: string[]): string {
  var index = defs.indexOf(name);
  if (index < 0) throw new Error("Undefined reference: @" + name);
  return index_to_bits(index, bits_per_ref(defs));
}

function bin_func(term: Term & { $: "App" }, d: number, defs: string[]): string {
  return term_to_bin(term.func, d, defs);
}

function bin_argm(term: Term & { $: "App" }, d: number, defs: string[]): string {
  return term_to_bin(term.argm, d, defs);
}

export function to_bin(book: Book): string {
  var defs = Object.keys(book);
  var bits = nat_to_bin(defs.length);
  for (var i = 0; i < defs.length; i++) {
    bits += term_to_bin(book[defs[i]], 0, defs);
  }
  return bits;
}

function read_nat(bits: string, pos: { i: number }): number {
  var n = 0;
  while (bits[pos.i] === "1") {
    n++;
    pos.i++;
  }
  if (bits[pos.i] !== "0") throw new Error("Invalid binary");
  pos.i++;
  return n;
}

function read_term(bits: string, pos: { i: number }, d: number, dns: string[]): string {
  var tag = bits[pos.i++]! + bits[pos.i++]!;
  switch (tag) {
    case "10": return name_of(d - read_nat(bits, pos) - 1);
    case "11": return read_ref(bits, pos, dns);
    case "00": return "λ" + name_of(d) + "." + read_term(bits, pos, d + 1, dns);
    case "01": return read_app(bits, pos, d, dns);
    default: throw "Invalid binary";
  }
}

function read_ref(bits: string, pos: { i: number }, dns: string[]): string {
  var index = bits_to_index(bits, pos, bits_per_ref(dns));
  if (index >= dns.length) throw new Error("Invalid binary");
  return "@" + dns[index];
}

function read_app(bits: string, pos: { i: number }, d: number, dns: string[]): string {
  var func = read_term(bits, pos, d, dns);
  var argm = read_term(bits, pos, d, dns);
  if (func.startsWith("λ")) {
    return "(" + func + ")(" + argm + ")";
  }
  return func + "(" + argm + ")";
}

export function from_bin(bits: string): string {
  var pos = { i: 0 };
  var count = read_nat(bits, pos);
  var dns = Array.from({ length: count }, (_, i) => name_of(i));
  var lines: string[] = [];
  for (var idx = 0; idx < count; idx++) {
    lines.push("@" + dns[idx] + " = " + read_term(bits, pos, 0, dns));
  }
  if (pos.i !== bits.length) throw new Error("Invalid binary");
  return lines.join("\n") + "\n";
}

// Affinity check

type Uses = { [key: string]: number };

function merge_uses(a: Uses, b: Uses): Uses {
  var result: Uses = { ...a };
  for (var k in b) {
    result[k] = (result[k] || 0) + b[k];
  }
  return result;
}

function check_lam(term: Term & { $: "Lam" }, d: number, dn: string, errs: string[]): Uses {
  var vname = "$" + d;
  var uses = check_term(term.body(Var(vname)), d + 1, dn, errs);
  var count = uses[vname] || 0;
  if (count > 1) {
    errs.push("@" + dn + ": λ" + name_of(d) + " used " + count + " times");
  }
  delete uses[vname];
  return uses;
}

function check_app(term: Term & { $: "App" }, d: number, dn: string, errs: string[]): Uses {
  return merge_uses(
    check_term(term.func, d, dn, errs),
    check_term(term.argm, d, dn, errs));
}

function check_term(term: Term, d: number, dn: string, errs: string[]): Uses {
  switch (term.$) {
    case "Var": return { [term.name]: 1 };
    case "Ref": return {};
    case "Lam": return check_lam(term, d, dn, errs);
    case "App": return check_app(term, d, dn, errs);
  }
}

export function check_affine(book: Book): string[] {
  var errs: string[] = [];
  for (var name in book) {
    check_term(book[name], 0, name, errs);
  }
  return errs;
}

// Normalize

function wnf_ref(book: Book, name: string): Term {
  if (!(name in book)) {
    return Ref(name);
  }
  return book[name];
}

function wnf_app(book: Book, func: Term, argm: Term, stats: Stats): Term {
  if (func.$ === "Lam") {
    stats.beta++;
    return wnf(book, func.body(argm), stats);
  }
  return App(func, argm);
}

export function wnf(book: Book, term: Term, stats: Stats): Term {
  switch (term.$) {
    case "Var": return term;
    case "Ref": return wnf(book, wnf_ref(book, term.name), stats);
    case "Lam": return term;
    case "App": return wnf_app(book, wnf(book, term.func, stats), term.argm, stats);
  }
}

export function snf(book: Book, term: Term, stats: Stats): Term {
  var t = wnf(book, term, stats);
  switch (t.$) {
    case "Var": return t;
    case "Ref": return t;
    case "Lam": return Lam(t.name, x => snf(book, t.body(x), stats));
    case "App": return App(snf(book, t.func, stats), snf(book, t.argm, stats));
  }
}
