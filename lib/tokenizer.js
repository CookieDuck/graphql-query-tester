const R = require('ramda');

const ARGUMENT_STRINGS = ['(', ':', '"', ',', ')',];
const FIELD_STRINGS = ['{', '}'];
const FRAGMENT_STRINGS = ['...'];
const ALL_KEY_STRINGS = R.unnest([ARGUMENT_STRINGS, FIELD_STRINGS, FRAGMENT_STRINGS]);

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
const makeRegexWithEscapedCharacters = R.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//TODO can probably make this varargs-y...
function sliceAtIndices(start, end) {
  return function(str) {
    return [ R.slice(0, start)(str), R.slice(start, end)(str), R.slice(end, R.length(str))(str) ];
  }
}

function addWhitespaceAround(accumulator, current) {
  return R.replace(
    R.compose(R.construct(RegExp)(R.__, 'g'), makeRegexWithEscapedCharacters)(current),
    ` ${current} `,
    accumulator);
}

function transparentLog(debug, prefix, input) {
  if (debug) {
    console.debug(prefix, input);
  }
  return input;
}

exports.tokenize = function (str, debug = false) {
  const debugLog = R.curry(transparentLog)(debug);
  return R.pipe(
    debugLog('Input:'),

    R.replace(newlinesAndTabs, ' '),
    debugLog('Removed newline characters:'),

    R.split(includeDoubleQuotes),
    debugLog('Split with preserved arguments:'),

    R.map(R.ifElse(
      R.allPass([
        R.compose(R.gt(R.__, 1), R.length),
        R.startsWith('"'),
        R.endsWith('"'),
      ]),
      sliceAtIndices(1, -1),
      R.compose(R.split(' '), R.trim, R.replace(/ +/g, ' '), R.reduce(addWhitespaceAround, R.__, ALL_KEY_STRINGS))
    )),
    debugLog('Mapped, processed strings'),

    R.unnest,
    debugLog('Un-nested (flattened) list:'),
  )(str);
};