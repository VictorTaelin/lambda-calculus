// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Lambda.js ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// A simple, clean and fast implementation of the λ-calculus on JavaScript.
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
module.exports = (function(){
  // Term -> Term
  // Creates an abstraction.
  function Lam(body){ 
    return {ctor:"Lam", body:body}; 
  };

  // Term, Term -> Term
  // The application of two terms.
  function App(func,argm){ 
    return {ctor:"App", func:func, argm:argm};
  };

  // Number -> Term
  // A bruijn-indexed variable.
  function Var(index){ 
    return {ctor:"Var", index:index}; 
  };

  // ∀ a . (Number -> a), (a, a -> a), (a -> a), Term -> a
  // Replaces constructors by functions.
  function fold(foldVar,foldLam,foldApp){
    return function go(term){
      switch (term.ctor){
        case "Var": return foldVar(term.index);
        case "Lam": return foldLam(go(term.body));
        case "App": return foldApp(go(term.func),go(term.argm));
      };
    };
  };

  // (Number -> t), (Number, t -> t), (t, t -> t), Term -> t
  // Folds using named variables (numeric names). 
  function foldScoped(foldVar, foldLam, foldApp){
    return (function(term){
      return fold(
        function(idx){return function(d){return foldVar(d-1-idx)}},
        function(body){return function(d){return foldLam(d, body(d+1))}},
        function(fun, arg){return function(d){return foldApp(fun(d), arg(d))}})
        (term)(0);
    })
  };

  // Number -> String
  // Converts a number to a variable name.
  var alphabet = "abcdefghijklmnopqrstuvwxyz";
  function toName(nat){
    var name = "";
    do {
      name += alphabet[nat % alphabet.length];
      nat = Math.floor(nat / alphabet.length);
    } while (nat > 0);
    return name;
  };

  // (String, String -> String), (String, String -> String) -> Term -> String
  // Converts a term to a specific language's source code. 
  function transmogrify(lam, app){
    return foldScoped(
      function(varid){ return toName(varid); },
      function(varid, body){ return lam(toName(varid),body); },
      function(func, argm){ return app(func,argm); });
  };

  // Number -> Term
  // Converts a JS number to a church-encoded nat.
  function fromNumber(num){
    return Lam(Lam((function go(n){return n===0?Var(0):App(Var(1),go(n-1))})(num)));
  };

  // Term -> Number
  // Converts a church-encoded nat to a JS number.
  function toNumber(term){
    return toFunction(term)(function(x){return x+1})(0);
  };

  // Function -> Term
  // Converts a native JS function to a term.
  function fromFunction(value){
    var nextVarId = 0;
    return (function normalize(value){
      return function(depth){
        function app(variable){
          function getArg(arg){
            return arg===null 
              ? variable
              : app(function(depth){
                return App(
                  variable(depth),
                  normalize(arg)(depth));
              });
          };
          getArg.isApp = true;
          return getArg;
        };
        if (value.isApp) 
          return value(null)(depth);
        else if (typeof value === "function") {
          var body = normalize(value(app(function(d){
              return Var(d-1-depth);
            })))(depth+1);
          return Lam(body);
        } else return value;
      };
    })(value)(0);
  };

  // Term -> String
  // Converts a term to a native JS function.
  function toFunction(term){
    return eval(transmogrify(
      function(varName, body){ return "(function("+varName+"){return "+body+"})"; },
      function(fun, arg){ return fun+"("+arg+")"; })
      (term));
  };

  // String -> Term
  var fromBruijn = function(source){
    var index = 0;
    return (function go(){
      if (source[index] === "L"){
        ++index;
        return Lam(go());
      } else if (source[index] === "("){
        ++index;
        var fun = go();
        ++index;
        var arg = go();
        ++index;
        return App(fun, arg); 
      } else {
        var idx = 0;
        while (/[0-9]/.test(source[index])){
          idx = idx * 10 + Number(source[index]);
          ++index;
        };
        return Var(idx);
      }
    })();
  };

  // Term -> String
  // Converts a term to a bruijn-syntax string.
  var toBruijn = fold(
    function(index){ return index; },
    function(body){ return "L" + body; },
    function(func,argm){ return "(" + func + " " + argm + ")"; });

  // String -> Term
  function fromString(source){
    var index = 0;
    return (function parse(depth, binders, aliases){
      while (/[^a-zA-Z0-9\(_]/.test(source[index]))
        ++index;
      if (source[index] === "(") {
        ++index;
        var app = parse(depth, binders, aliases);
        while (source[index] !== ")")
          app = App(app, parse(depth, binders, aliases));
        ++index;
        return app;
      } else {
        var binder = "";
        while (/[a-zA-Z0-9_]/.test(source[index]) && index !== source.length)
          binder += source[index++];
        switch (source[index]) {
          case ".":
            return Lam(parse(depth+1, binders.concat(binder), aliases.concat(null)))
          case ":":
            var term = parse(depth, binders, aliases);
            var body = parse(depth+1, binders.concat(binder), aliases.concat(term));
            return body;
          default:
            var idx = binders.lastIndexOf(binder);
            return aliases[idx] || Var(depth - idx - 1);
        }
      }
    })(0, [], []);
  };

  // Term -> String
  var toString = transmogrify(
    function(arg,bod){return arg+"."+bod},
    function(fun,arg){return "("+fun+" "+arg+")"});

  // String -> Term
  // Converts a binary lambda calculus string to a term.
  function fromBLC(source){
    var index = 0;
    return (function go(){
      if (source[index] === "0")
        return source[index+1] === "0"
          ? (index+=2, Lam(go()))
          : (index+=2, App(go(), go()));
      for (var i=0; source[index]!=="0"; ++i)
        ++index;
      return (++index, Var(i-1));
    })();
  };

  // Term -> String
  // Converts a term to a binary lambda calculus string.
  var toBLC = fold(
    function(idx) { for (var i=0, s=""; i<=idx; ++i) s+="1"; return s+"0"; },
    function(body){ return "00" + body; },
    function(a,b) { return "01" + a + b; });

  // Map String String
  // A bijective map between 6bit-strings and base64 digits.
  var base64Table = {};
  for (var i=0; i<64; ++i){
    var bin = ("000000"+i.toString(2)).slice(-6);
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[i];
    base64Table[bin] = b64;
    base64Table[b64] = bin;
  };

  // String -> Term
  // Converts a base64 binary lambda calculus string to a term.
  function fromBLC64(digits){
    var blc = "";
    for (var d=0, l=digits.length; d<l; ++d){
      var bits = base64Table[digits[d]];
      blc += d === 0 ? bits.slice(bits.indexOf("1")+1) : bits;
    };
    return fromBLC(blc);
  };

  // Term -> String
  // Converts a term to a base64 binary lambda calculus string.
  function toBLC64(term){
    var blc = toBLC(term);
    var digits = "";
    for (var d=0, l=blc.length; d<=l/6; ++d){
      var i = l - d*6 - 6;
      var bits = i < 0 
        ? ("000001"+blc.slice(0, i+6)).slice(-6)
        : blc.slice(i, i+6);
      digits = base64Table[bits] + digits;
    };
    return digits;
  };

  // Term -> Term
  // Reduces a term to normal form using native JS functions.
  function reduce(term){
    return fromFunction(toFunction(term));
  };

  return {
    Lam: Lam,
    App: App,
    Var: Var,
    fold: fold,
    foldScoped: foldScoped,
    fromNumber: fromNumber,
    toNumber: toNumber,
    fromFunction: fromFunction,
    toFunction: toFunction,
    fromBruijn: fromBruijn,
    toBruijn: toBruijn,
    fromString: fromString,
    toString: toString,
    toBLC: toBLC,
    fromBLC: fromBLC,
    toBLC64: toBLC64,
    fromBLC64: fromBLC64,
    reduce: reduce
  };
})();
