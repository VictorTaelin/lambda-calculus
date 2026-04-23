# lam

A minimal lambda calculus normalizer.

## Install

```bash
bun link
```

## Usage

```bash
lam [-s] <file.lam> [entry]
lam --to-bin <file.lam>
lam --from-bin <bits>
```

- `-s` shows stats (beta reductions, time, performance).
- `entry` selects which definition to normalize (defaults to last).
- `--to-bin` encodes a book as a binary string.
- `--from-bin` decodes a binary string back to a book.

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
`(((f x) y) z)`.

Output always uses canonical names (`a`, `b`, `c`, ...) based on lambda depth,
so alpha-equivalent terms are string-equal.

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

The `--to-bin` and `--from-bin` flags convert between text and binary. The
round-trip is exact: `to_bin(from_bin(bits)) == bits`.

## Examples

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

$ lam -s exs/cnats.lam
λa.λb.a(a(a(a(a(a(b))))))
- beta: 31
- time: 0.000 seconds
- perf: 741769 betas/s

$ lam exs/cnats.lam two
λa.λb.a(a(b))

$ lam --to-bin exs/cnats.lam
10000100100000001101001011011010101001...

$ lam --from-bin "$(lam --to-bin exs/cnats.lam)"
@a = λa.λb.b
@b = λa.λb.λc.b(a(b)(c))
@c = λa.λb.λc.λd.a(c)(b(c)(d))
@d = λa.λb.λc.a(b(c))
@e = @b(@b(@a))
@f = @b(@e)
@g = @d(@e)(@f)
```

Recursive Scott naturals (mul2):

```
@Z    = λz.λs.z
@S    = λn.λz.λs.s(n)
@mul2 = λn.n(@Z, λp.@S(@S(@mul2(p))))
@n4   = @S(@S(@S(@S(@Z))))
@main = @mul2(@n4)
```

```bash
$ lam exs/snat.lam
λa.λb.b(λc.λd.d(λe.λf.f(λg.λh.h(λi.λj.j(λk.λl.l(λm.λn.n(λo.λp.p(λq.λr.q))))))))
```
