module Lam
  ( Book
  , Term(..)
  , parseBook
  , showTerm
  , snf
  , toBin
  , fromBin
  , checkAffine
  ) where

import Data.Char (isAlphaNum, isSpace)
import Data.List (findIndex, intercalate, isPrefixOf)

data Term
  = Var String
  | Ref String
  | Lam String (Term -> Term)
  | App Term Term

type Book = [(String, Term)]
type Env = [(String, Term)]
type Uses = [(String, Int)]

nameOf :: Int -> String
nameOf n
  | n < 26 = [toEnum (97 + n)]
  | otherwise = nameOf (n `div` 26 - 1) ++ [toEnum (97 + n `mod` 26)]

unapp :: Term -> (Term, [Term])
unapp (App f x) = let (h, xs) = unapp f in (h, xs ++ [x])
unapp term = (term, [])

showTerm :: Term -> String
showTerm term = go 0 term where
  go _ (Var n) = n
  go _ (Ref n) = "@" ++ n
  go d (Lam _ body) =
    let n = nameOf d in "\955" ++ n ++ "." ++ go (d + 1) (body (Var n))
  go d app@(App _ _) =
    let (h, xs) = unapp app
    in showHead d h ++ "(" ++ intercalate ", " (map (go d) xs) ++ ")"
  showHead d lam@(Lam _ _) = "(" ++ go d lam ++ ")"
  showHead d other = go d other

newtype Parser a = Parser { runParser :: String -> Either String (a, String) }

instance Functor Parser where
  fmap f p = Parser $ \s -> do
    (x, s') <- runParser p s
    pure (f x, s')

instance Applicative Parser where
  pure x = Parser $ \s -> Right (x, s)
  pf <*> px = Parser $ \s -> do
    (f, s') <- runParser pf s
    (x, s'') <- runParser px s'
    pure (f x, s'')

instance Monad Parser where
  p >>= f = Parser $ \s -> do
    (x, s') <- runParser p s
    runParser (f x) s'

skip :: Parser ()
skip = Parser $ \s -> Right ((), go s) where
  go ('/':'/':xs) = go (drop 1 (dropWhile (/= '\n') xs))
  go (x:xs) | isSpace x = go xs
  go xs = xs

peek :: Parser (Maybe Char)
peek = Parser $ \s -> Right (case s of [] -> Nothing; c:_ -> Just c, s)

char :: Char -> Parser ()
char c = Parser $ \s -> case s of
  x:xs | x == c -> Right ((), xs)
  _ -> Left ("Expected '" ++ [c] ++ "'")

name :: Parser String
name = Parser $ \s ->
  let (n, rest) = span isNameChar s
  in if null n then Left "Expected name" else Right (n, rest)
  where
    isNameChar x = isAlphaNum x || x == '_'

parseCalls :: Parser (Env -> Term) -> Parser (Env -> Term)
parseCalls pf = do
  skip
  m <- peek
  case m of
    Just '(' -> do
      char '('
      args <- parseArgs []
      parseCalls $ do
        f <- pf
        pure $ \env -> foldl App (f env) [a env | a <- args]
    _ -> pf

parseArgs :: [Env -> Term] -> Parser [Env -> Term]
parseArgs args = do
  skip
  m <- peek
  case m of
    Just ')' -> char ')' >> pure args
    _ -> do
      if null args then pure () else char ','
      arg <- parseTerm
      parseArgs (args ++ [arg])

parseTerm :: Parser (Env -> Term)
parseTerm = do
  skip
  m <- peek
  case m of
    Just '\955' -> do
      char '\955'
      n <- name
      char '.'
      body <- parseTerm
      pure $ \env -> Lam n $ \x -> body ((n, x) : env)
    Just '@' -> do
      char '@'
      n <- name
      parseCalls (pure $ const (Ref n))
    Just '(' -> do
      char '('
      inner <- parseTerm
      skip
      char ')'
      parseCalls (pure inner)
    _ -> do
      n <- name
      parseCalls $ pure $ \env -> case lookup n env of
        Just v -> v
        Nothing -> error ("unbound variable: " ++ n)

parseDef :: Parser (String, Term)
parseDef = do
  skip
  char '@'
  n <- name
  skip
  char '='
  term <- parseTerm
  pure (n, term [])

parseDefs :: Book -> Parser Book
parseDefs book = do
  skip
  m <- peek
  case m of
    Nothing -> pure book
    _ -> do
      def <- parseDef
      parseDefs (book ++ [def])

parseBook :: String -> Either String Book
parseBook code = do
  (book, rest) <- runParser (parseDefs []) code
  let rest' = dropWhile isSpace rest
  if null rest' then Right book else Left "Unexpected input"

natToBin :: Int -> String
natToBin n
  | n < 0 = error ("Invalid natural number: " ++ show n)
  | otherwise = replicate n '1' ++ "0"

bitsPerCount :: Int -> Int
bitsPerCount n = ceiling (logBase 2 (fromIntegral (max n 1)) :: Double)

bitsPerRef :: Book -> Int
bitsPerRef = bitsPerCount . length

indexToBits :: Int -> Int -> String
indexToBits index width
  | index < 0 || index >= 2 ^ width =
      error ("Invalid global reference index: " ++ show index)
  | otherwise =
      let bits = toBinary index
      in replicate (width - length bits) '0' ++ bits
  where
    toBinary 0 = ""
    toBinary n = toBinary (n `div` 2) ++ show (n `mod` 2)

refToBin :: String -> Book -> String
refToBin n defs = case findIndex ((== n) . fst) defs of
  Just i -> indexToBits i (bitsPerRef defs)
  Nothing -> error ("Undefined reference: @" ++ n)

termToBin :: Book -> Int -> Term -> String
termToBin defs d term = case term of
  Var n -> "10" ++ natToBin (d - read (drop 1 n) - 1)
  Ref n -> "11" ++ refToBin n defs
  Lam _ body -> "00" ++ termToBin defs (d + 1) (body (Var ("$" ++ show d)))
  App f x -> "01" ++ termToBin defs d f ++ termToBin defs d x

toBin :: Book -> String
toBin book = natToBin (length book) ++ concatMap (termToBin book 0 . snd) book

readNat :: String -> Either String (Int, String)
readNat bits =
  let (ones, rest) = span (== '1') bits
  in case rest of
    '0':xs -> Right (length ones, xs)
    _ -> Left "Invalid binary"

takeBits :: Int -> String -> Either String (String, String)
takeBits n bits =
  let (chunk, rest) = splitAt n bits
  in if length chunk == n && all (`elem` "01") chunk
    then Right (chunk, rest)
    else Left "Invalid binary"

bitsToIndex :: Int -> String -> Either String (Int, String)
bitsToIndex width bits
  | width == 0 = Right (0, bits)
  | otherwise = do
      (chunk, rest) <- takeBits width bits
      pure (foldl (\n c -> n * 2 + if c == '1' then 1 else 0) 0 chunk, rest)

readTerm :: Int -> [String] -> String -> Either String (String, String)
readTerm d defs bits = case bits of
  '1':'0':rest -> do
    (n, rest') <- readNat rest
    let i = d - n - 1
    if i >= 0 then pure (nameOf i, rest') else Left "Invalid binary"
  '1':'1':rest -> do
    (i, rest') <- bitsToIndex (bitsPerCount (length defs)) rest
    if i < length defs
      then pure ("@" ++ defs !! i, rest')
      else Left "Invalid binary"
  '0':'0':rest -> do
    let n = nameOf d
    (body, rest') <- readTerm (d + 1) defs rest
    pure ("\955" ++ n ++ "." ++ body, rest')
  '0':'1':rest -> readApp d defs rest
  _ -> Left "Invalid binary"

readApp :: Int -> [String] -> String -> Either String (String, String)
readApp d defs bits = do
  (f, rest) <- readTerm d defs bits
  (x, rest') <- readTerm d defs rest
  let head' = if "\955" `isPrefixOf` f then "(" ++ f ++ ")" else f
  pure (head' ++ "(" ++ x ++ ")", rest')

fromBin :: String -> Either String String
fromBin bits = do
  (count, rest) <- readNat bits
  let defs = [nameOf i | i <- [0 .. count - 1]]
  (lines', rest') <- go defs defs rest
  if null rest'
    then Right (unlines lines')
    else Left "Invalid binary"
  where
    go _ [] rest = Right ([], rest)
    go allDefs (d:ds) rest = do
      (term, rest') <- readTerm 0 allDefs rest
      (terms, rest'') <- go allDefs ds rest'
      pure (("@" ++ d ++ " = " ++ term) : terms, rest'')

mergeUses :: Uses -> Uses -> Uses
mergeUses xs ys = foldl add xs ys where
  add acc (k, n) = case lookup k acc of
    Nothing -> (k, n) : acc
    Just m -> (k, m + n) : filter ((/= k) . fst) acc

checkTerm :: String -> Int -> Term -> (Uses, [String])
checkTerm dn d term = case term of
  Var n -> ([(n, 1)], [])
  Ref _ -> ([], [])
  Lam _ body ->
    let v = "$" ++ show d
        (uses, errs) = checkTerm dn (d + 1) (body (Var v))
        count = maybe 0 id (lookup v uses)
        uses' = filter ((/= v) . fst) uses
        err = "@" ++ dn ++ ": \955" ++ nameOf d ++ " used "
          ++ show count ++ " times"
    in (uses', if count > 1 then err : errs else errs)
  App f x ->
    let (fu, fe) = checkTerm dn d f
        (xu, xe) = checkTerm dn d x
    in (mergeUses fu xu, fe ++ xe)

checkAffine :: Book -> [String]
checkAffine book = concatMap checkDef book where
  checkDef (n, term) = snd (checkTerm n 0 term)

wnf :: Book -> Term -> (Term, Int)
wnf book term = case term of
  Var _ -> (term, 0)
  Ref n -> case lookup n book of
    Nothing -> (term, 0)
    Just t -> wnf book t
  Lam _ _ -> (term, 0)
  App f x ->
    let (f', c) = wnf book f
    in case f' of
      Lam _ body ->
        let (r, c') = wnf book (body x)
        in (r, c + 1 + c')
      _ -> (App f' x, c)

snfAt :: Int -> Book -> Term -> (Term, Int)
snfAt d book term =
  let (term', c) = wnf book term
  in case term' of
    Var _ -> (term', c)
    Ref _ -> (term', c)
    Lam n body ->
      let (b, c') = snfAt (d + 1) book (body (Var (nameOf d)))
      in (Lam n (const b), c + c')
    App f x ->
      let (f', c1) = snfAt d book f
          (x', c2) = snfAt d book x
      in (App f' x', c + c1 + c2)

snf :: Book -> Term -> (Term, Int)
snf = snfAt 0
