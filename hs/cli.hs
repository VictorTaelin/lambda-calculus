module Main where

import Control.Exception (evaluate)
import Data.Char (isSpace)
import Data.List (isPrefixOf, isSuffixOf)
import System.Environment (getArgs)
import System.Exit (die, exitFailure)
import Text.Printf (printf)
import Data.Time.Clock (diffUTCTime, getCurrentTime)

import Lam

usage :: String
usage = "Usage: lam <file.lam|bits> [args...] [-s] [--to-bin|--from-bin|--affine]"

splitArgs :: [String] -> ([String], [String])
splitArgs = foldr step ([], []) where
  step arg (flags, vals)
    | "-" `isPrefixOf` arg = (arg : flags, vals)
    | otherwise = (flags, arg : vals)

hasFlag :: [String] -> String -> Bool
hasFlag flags flag = flag `elem` flags

stripComments :: String -> String
stripComments [] = []
stripComments ('/':'/':xs) = stripComments (dropWhile (/= '\n') xs)
stripComments (x:xs) = x : stripComments xs

loadInput :: String -> String -> IO String
loadInput suffix input
  | suffix `isSuffixOf` input = readFile input
  | otherwise = pure input

parseOrDie :: String -> IO Book
parseOrDie code = case parseBook code of
  Right book -> pure book
  Left err -> die ("error: " ++ err)

wrapCode :: String -> String
wrapCode code
  | ("@" `isPrefixOf` dropWhile isSpace (stripComments code)) = code
  | otherwise = "@main = " ++ code

parseArg :: String -> IO Term
parseArg arg = do
  book <- parseOrDie ("@_ = " ++ arg)
  case lookup "_" book of
    Just term -> pure term
    Nothing -> die "error: failed to parse argument"

main :: IO ()
main = do
  (flags, positional) <- splitArgs <$> getArgs
  case positional of
    [] -> die usage
    input:extras
      | hasFlag flags "--from-bin" -> do
          bits <- trim <$> loadInput ".bin" input
          case fromBin bits of
            Right code -> putStr code
            Left err -> die ("error: " ++ err)
      | otherwise -> do
          code <- loadInput ".lam" input
          book <- parseOrDie (wrapCode code)
          if hasFlag flags "--to-bin"
            then putStrLn (toBin book)
            else if hasFlag flags "--affine"
              then runAffine book
              else runEval flags book extras
  where
    trim = reverse . dropWhile isSpace . reverse . dropWhile isSpace

runAffine :: Book -> IO ()
runAffine book = case checkAffine book of
  [] -> putStrLn "✓ all definitions are affine"
  errs -> do
    mapM_ (putStrLn . ("✗ " ++)) errs
    exitFailure

runEval :: [String] -> Book -> [String] -> IO ()
runEval flags book extras = do
  entry <- case book of
    [] -> die "error: empty book"
    _ -> pure (fst (last book))
  args <- mapM parseArg extras
  let term = foldl App (Ref entry) args
  t0 <- getCurrentTime
  (result, beta) <- evaluate (snf book term)
  t1 <- getCurrentTime
  putStrLn (showTerm result)
  if hasFlag flags "-s"
    then do
      let dt = realToFrac (diffUTCTime t1 t0) :: Double
          perf = if dt == 0 then beta else round (fromIntegral beta / dt)
      putStrLn ("- beta: " ++ show beta)
      printf "- time: %.3f seconds\n" dt
      putStrLn ("- perf: " ++ show perf ++ " betas/s")
    else pure ()
