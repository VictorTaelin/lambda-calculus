# lam

A minimal lambda calculus normalizer.

## Install

```bash
npm i -g lambda-calculus
```

## Usage

```bash
lam <file.lam> [args...] [-s] [--to-bin] [--from-bin] [--affine]
```

- Extra arguments are applied to the last definition before normalizing.
- `-s` shows stats (beta reductions, time, performance).
- `--to-bin` encodes a book as a binary string.
- `--from-bin` decodes a binary string (or `.bin` file) back to a book.
- `--affine` checks that all definitions use each variable at most once.

## Syntax

| Form        | Syntax        |
|-------------|---------------|
| Variable    | `x`           |
| Reference   | `@foo`        |
| Lambda      | `λx.body`     |
| Application | `f(x, y, z)`  |
| Definition  | `@foo = term` |

A `.lam` file is a book of top-level `@`-definitions. Definitions may reference
each other, including themselves (recursion). `f(x, y, z)` desugars to
`(((f x) y) z)`. The last definition is the entry point.

Output always uses canonical names (`a`, `b`, `c`, ...) based on lambda depth,
so alpha-equivalent terms are string-equal.

## Examples

Church numerals — `mul(2, 3) = 6`:

```
@zero  = λf.λx.x
@succ  = λn.λf.λx.f(n(f, x))
@mul   = λm.λn.λf.m(n(f))
@two   = @succ(@succ(@zero))
@three = @succ(@two)
@main  = @mul(@two, @three)
```

```bash
$ lam exs/cnats.lam
λa.λb.a(a(a(a(a(a(b))))))

$ lam exs/cnats.lam -s
λa.λb.a(a(a(a(a(a(b))))))
- beta: 31
- time: 0.000 seconds
- perf: 741769 betas/s
```

External arguments — apply the last def to extra terms:

```bash
$ lam '@add = λm.λn.λf.λx.m(f, n(f, x))
@main = @add' "λf.λx.f(f(x))" "λf.λx.f(f(f(x)))"
λa.λb.a(a(a(a(a(b)))))
```

Affinity check:

```bash
$ lam exs/snat.lam --affine
✓ all definitions are affine

$ lam exs/cnats.lam --affine
✗ @succ: λb used 2 times
✗ @add: λc used 2 times
```

## Binary encoding

Books and terms have a compact binary representation:

```
Book ::= 1 Term Book | 0
Term ::= 10 Name       (Var)
       | 11 Name       (Ref)
       | 00 Term       (Lam)
       | 01 Term Term  (App)
Name ::= 1 Name | 0    (unary nat)
```

A Var name is a de Bruijn index (0 = innermost lambda). A Ref name is a
backwards index into the book (0 = self, 1 = previous def, etc.).

The round-trip is exact: `to_bin(from_bin(bits)) == bits`.

```bash
$ lam exs/cnats.lam --to-bin
10000100100000001101001011011010101001...

$ lam --from-bin "$(lam exs/cnats.lam --to-bin)"
@a = λa.λb.b
@b = λa.λb.λc.b(a(b)(c))
@c = λa.λb.λc.λd.a(c)(b(c)(d))
@d = λa.λb.λc.a(b(c))
@e = @b(@b(@a))
@f = @b(@e)
@g = @d(@e)(@f)
```
