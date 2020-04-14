'use strict';

const {
  __,
  allPass,
  compose,
  construct,
  curry,
  endsWith,
  gt,
  ifElse,
  length,
  reduce,
  replace,
  map,
  pipe,
  slice,
  split,
  startsWith,
  trim,
  unnest,
} = require('ramda');

const ARGUMENT_STRINGS = ['(', ':', '"', ',', ')',];
const FIELD_STRINGS = ['{', '}'];
const FRAGMENT_STRINGS = ['...'];
const ALL_KEY_STRINGS = unnest([ARGUMENT_STRINGS, FIELD_STRINGS, FRAGMENT_STRINGS]);

const newlinesAndTabs = /(\r\n|\n|\r|\t)/g;

/*
 Bless ye, stack overflow: https://stackoverflow.com/questions/5695240/php-regex-to-ignore-escaped-quotes-within-quotes
 This regex splits on substrings between (and including!) quote characters, ignoring any escaped characters between the quotes.

 For example, given this string:
   'take "me out \"\n\t to" the "ba\"ll" game'
 the returned array is:
   [ 'take ', '"me out \"\n\t to"', ' the ', '"ba\"ll"', ' game' ]
 */
const includeDoubleQuotes = /("[^"\\]*(?:\\.[^"\\]*)*")/;

// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
// makeRegexWithEscapedCharacters = String -> String
const makeRegexWithEscapedCharacters = replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//TODO can probably make this varargs-y...
// sliceAtIndices :: Integer, Integer,  String -> [String]
const sliceAtIndices = curry((start, end, str) => [
  slice(0, start, str),
  slice(start, end, str),
  slice(end, length(str), str),
]);

// addWhitespaceAround :: String, String -> String
const addWhitespaceAround = (accumulator, current) =>
  replace(
    compose(construct(RegExp)(__, 'g'), makeRegexWithEscapedCharacters)(current),
    ` ${current} `,
    accumulator
  );

// transparentLog :: Boolean, String, a -> a
const transparentLog = curry((debug, prefix, input) => {
  if (debug) {
    console.debug(prefix, input);
  }
  return input;
});

// tokenize :: String, Boolean -> [String]
exports.tokenize = (str, debug = false) => {
  const debugLog = transparentLog(debug);
  return pipe(
    debugLog('Input:'),

    replace(newlinesAndTabs, ' '),
    debugLog('Removed newline characters:'),

    split(includeDoubleQuotes),
    debugLog('Split with preserved arguments:'),

    map(ifElse(
      allPass([
        compose(gt(__, 1), length),
        startsWith('"'),
        endsWith('"'),
      ]),
      sliceAtIndices(1, -1),
      compose(split(' '), trim, replace(/ +/g, ' '), reduce(addWhitespaceAround, __, ALL_KEY_STRINGS))
    )),
    debugLog('Mapped, processed strings'),

    unnest,
    debugLog('Un-nested (flattened) list:'),
  )(str);
};