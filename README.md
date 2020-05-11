## Lambda Calculus

*Note: there is a cleaner implementation on the issues, will merge eventually...*

A simple, clean and fast implementation of the λ-calculus on JavaScript. It has zero dependencies and only 2.65KB gzipped. It evaluates terms very efficiently by using native JS functions, which is possible thanks to a clever compile/readback algorithm based on JS semantics. It includes the most relevant IO formats - bruijn-indices, binary, base64 and the usual "Wikipedia syntax" - so you can easily export to/from other tools. You can also convert native JS functions to terms and back.

#### Install

    npm install lambda-calculus

#### Example

```JavaScript
const lam = require("lambda-calculus");

// Parses an input with the "Wikipedia syntax". The lambdas are optional
const input = lam.fromString("(λa.λb.(a (a b)) λa.λb.(a (a b)))");

// Computes the result using native JS functions
const output = lam.reduce(input);

// Print the result
console.log("Result: "+lam.toString(output));

// Print the result as bruijn
console.log("Result (in bruijn): "+lam.toBruijn(output));

// Print the result as binary
console.log("Result (in binary): "+lam.toBLC(output));

// Print the result as base64 
console.log("Result (in base64): "+lam.toBLC64(output));

// There is a corresponding `lam.fromFormat(str)` for all functions above
```

Output:

```bash
Result: a.b.(a (a (a (a b))))
Result (in bruijn): LL(1 (1 (1 (1 0))))
Result (in binary): 00000111001110011100111010
Result (in base64): EHOc6
```

#### API

```haskell
-- To/from native JS functions
fromFunction : Function -> Term
toFunction   : Term -> Function

-- To/from JS numbers (using the church-encoding)
fromNumber : Number -> Term
toNumber   : Term -> Number

-- To/from the "Wikipedia syntax"
fromString : String -> Term
toString   : Term -> String

-- To/from bruijn-indices
fromBruijn : String -> Term
toBruijn   : Term -> String

-- To/from binary lambda calculus
fromBLC : String -> Term
toBLC   : Term -> String

-- To/from base64-encoded binary lambda calculus
fromBLC64 : String -> Term
toBLC64   : Term -> String

-- Reduces a term to normal form
reduce : Term -> Term
reduce = fromFunction . toFunction
```
