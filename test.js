const assert = require("assert");
const lam    = require("./lambda-calculus.js");

var n0  = `LL0`;
var n1  = `LL(1 0)`;
var n2  = `LL(1 (1 0))`;
var n3  = `LL(1 (1 (1 0)))`;
var n4  = `LL(1 (1 (1 (1 0))))`;
var n5  = `LL(1 (1 (1 (1 (1 0)))))`;
var n6  = `LL(1 (1 (1 (1 (1 (1 0))))))`;
var n7  = `LL(1 (1 (1 (1 (1 (1 (1 0)))))))`;
var n8  = `LL(1 (1 (1 (1 (1 (1 (1 (1 0))))))))`;
var n9  = `LL(1 (1 (1 (1 (1 (1 (1 (1 (1 0)))))))))`;
var add = `LLLL((3 1) ((2 1) 0))`;
var mul = `LLL(2 (1 0))`;
var pow = `LL(0 1)`;

// Test reductions and string encodings
function reduce(code){
  return lam.toBruijn(lam.reduce(lam.fromBruijn(code)));
};
assert(reduce(`((${add} ${n2}) ${n3})`) === n5);
assert(reduce(`((${mul} ${n2}) ${n3})`) === n6);
assert(reduce(`((${pow} ${n2}) ${n3})`) === n8);

// Test BLC / BLC64 encodings
assert(lam.toBruijn(lam.fromBLC("0000011100111001110011100111010")) === n5);
assert(lam.toBLC(lam.fromBruijn(n5)) === "0000011100111001110011100111010");
assert(lam.toBruijn(lam.fromBLC64("CDnOc6")) === n5);
assert(lam.toBLC64(lam.fromBruijn(n5)) === "CDnOc6");

// Test BLC / BLC64 round trips
[n0, n1, n2, n3, n4, n5, n6, n7, n8, n9].map(function(term){
  assert(term === lam.toBruijn(lam.fromBLC  (lam.toBLC  (lam.fromBruijn(term)))));
  assert(term === lam.toBruijn(lam.fromBLC64(lam.toBLC64(lam.fromBruijn(term)))));
});
