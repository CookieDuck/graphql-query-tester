'use strict';

const printTableForItems = require('./util').printTableForItems;

const {
  __,
  always,
  assoc,
  compose,
  cond,
  curry,
  dec,
  equals,
  filter,
  gt,
  head,
  identity,
  ifElse,
  inc,
  isNil,
  last,
  map,
  pipe,
  prop,
  propEq,
  propOr,
  reduce,
  not,
  T,
} = require('ramda');

// Custom Types:
// Lexed: { value: String, definition: String, index: Integer, depth: Integer }

const dict = {
  WORD: 'word',

  FIELD_BRANCH: 'field (branch)',
  FIELD_LEAF: 'field (leaf)',

  GROUP_START: 'group start',
  GROUP_END: 'group end',

  // Argument definitions
  ARGUMENT_START: 'argument start',
  ARGUMENT_END: 'argument end',
  ARGUMENT_NAME: 'argument name',
  ARGUMENT_VALUE: 'argument value',
  COLON: 'argument name/value separator',
  QUOTES: 'argument value start/end character for string',
  COMMA: 'argument separator',

  // Fragment definitions
  ELLIPSIS: 'fragment ellipsis',
  FRAGMENT_KEYWORD: "keyword 'fragment'",
  ON_KEYWORD: "keyword 'on'",
  FRAGMENT_NAME: 'name for fragment (must reference a declaration)',
  FRAGMENT_DECLARATION: 'declaration of a fragment',
  FRAGMENT_TYPE_NAME: 'name of type referenced by fragment',

  // Just for AST nodes in parser
  INLINE_FRAGMENT: "inline fragment declaration",

  // Special "branch" to designate root
  QUERY: "root query",
};

// isType :: String -> Lexed -> Boolean
const isType = (type) => propEq('definition', type);

// all these dict helpers :: Lexed -> Boolean
const isWord = isType(dict.WORD);
const isNotWord = compose(not, isWord);
const isFragmentName = isType(dict.FRAGMENT_NAME);
const isFragmentDeclaration = isType(dict.FRAGMENT_DECLARATION);
const isGroupStart = isType(dict.GROUP_START);
const isGroupEnd = isType(dict.GROUP_END);
const isArgumentStart = isType(dict.ARGUMENT_START);
const isArgumentEnd = isType(dict.ARGUMENT_END);
const isColon = isType(dict.COLON);
const isQuotes = isType(dict.QUOTES);
const isEllipsis = isType(dict.ELLIPSIS);
const isFragmentKeyword = isType(dict.FRAGMENT_KEYWORD);
const isOnKeyword = isType(dict.ON_KEYWORD);

// depthReducer :: [Lexed], Lexed -> [Lexed]
const depthReducer = (accumulator, current) => {
  const lastItemInAccumulator = ifElse(isNil, always({}), identity)(last(accumulator));
  const depthOfLastItemInAccumulator = depthOfLast(accumulator);
  const getCurrentDepth = cond([
    [() => isGroupStart(lastItemInAccumulator), always(inc(depthOfLastItemInAccumulator))],
    [() => isGroupEnd(current),                 always(dec(depthOfLastItemInAccumulator))],
    [T,                                         always(depthOfLastItemInAccumulator)],
  ]);
  return [
    ...accumulator,
    assoc('depth', getCurrentDepth(), current)
  ];
};

// depthOfLast = [Lexed] -> Integer
const depthOfLast = compose(propOr(0, 'depth'), last);

// validateGroups :: [Lexed] -> String or Null
const validateGroups = (lexed) => {
  const groupStarts = lexed.filter(isGroupStart).length;
  const groupEnds = lexed.filter(isGroupEnd).length;
  return cond([
    [equals(groupEnds), always(null)],
    [gt(groupEnds),     always(`Syntax error: Found ${groupEnds} '}' but only ${groupStarts} '{'`)],
    [T,                 always(`Syntax error: Found ${groupStarts} '{' but only ${groupEnds} '}'`)],
  ])(groupStarts);
};

// checkWord :: String -> Boolean
const checkWord = (str) => /\w/.test(str);

// defineToken :: String -> String
const defineToken = cond([
  [equals('{'),        always(dict.GROUP_START)],
  [equals('}'),        always(dict.GROUP_END)],
  [equals('('),        always(dict.ARGUMENT_START)],
  [equals(')'),        always(dict.ARGUMENT_END)],
  [equals(':'),        always(dict.COLON)],
  [equals('"'),        always(dict.QUOTES)],
  [equals(','),        always(dict.COMMA)],
  [equals('...'),      always(dict.ELLIPSIS)],
  [equals('on'),       always(dict.ON_KEYWORD)],
  [equals('fragment'), always(dict.FRAGMENT_KEYWORD)],
  [checkWord,          always(dict.WORD)],
  [T,                  always(null)],
]);

// refineWords :: [Lexed] -> Void
const refineWords = (input) => {
  const next = compose(prop(__, input), inc, prop('index'));
  const prev = compose(prop(__, input), dec, prop('index'));
  const assocDef = assoc('definition');
  const assocArgumentNode = (node) => {
    const argumentEnd = head(input.slice(prop('index', node)).filter(isArgumentEnd));
    const definition = argumentEnd && isGroupStart(input[inc(argumentEnd.index)]) ?
      dict.FIELD_BRANCH :
      dict.FIELD_LEAF;
    return assocDef(definition)(node);
  };

  return input.map(
    cond([
      [isNotWord,                        identity],
      [compose(isColon, next),           assocDef(dict.ARGUMENT_NAME)],
      [compose(isQuotes, prev),          assocDef(dict.ARGUMENT_VALUE)],
      [compose(isColon, prev),           assocDef(dict.ARGUMENT_VALUE)],
      [compose(isEllipsis, prev),        assocDef(dict.FRAGMENT_NAME)],
      [compose(isFragmentKeyword, prev), assocDef(dict.FRAGMENT_DECLARATION)],
      [compose(isOnKeyword, prev),       assocDef(dict.FRAGMENT_TYPE_NAME)],
      [compose(isGroupStart, next),      assocDef(dict.FIELD_BRANCH)],
      [compose(isArgumentStart, next),   assocArgumentNode],
      [T,                                assocDef(dict.FIELD_LEAF)],
    ])
  );
};

// getPropAfterFilter :: String, fn -> fn
const getPropAfterFilter = curry((propName, filterFn) => pipe(filter(filterFn), map(prop(propName))));

// TODO yikes!  Throws an Error or returns nothing
// checkFragments :: [Lexed] -> Void
const checkFragments = (lexed) => {
  const references = getPropAfterFilter('value', isFragmentName)(lexed);
  const declarations = getPropAfterFilter('value', isFragmentDeclaration)(lexed);
  verifyReferencesAndDeclarations(references, declarations);
};

// TODO yikes!  Throws an Error or returns nothing
// verifyReferencesAndDeclarations :: [String], [String] -> Void
const verifyReferencesAndDeclarations = (references, declarations) => {
  references.forEach((name) => {
    if (!declarations.includes(name)) {
      const definitions = `[${declarations.join(", ")}]`;
      let error = `Syntax error: Fragment '${name}' has no definition.  `;
      error += `Available fragment definitions: ${definitions}`;
      throw Error(error);
    }
  });

  const refs = Array.from(references); // clients either pass a set or an array, so coerce to array always
  declarations.forEach((name) => {
    if (!refs.includes(name)) {
      throw Error(`Syntax error: Fragment '${name}' is declared, but never used`);
    }
  });
};

// printDebug :: [String], [Lexed] -> Void
const printDebug = (tokens, lexed) => {
  const tabLevel = 4;
  let tokenMaxLength = -1;
  for (let i = 0; i < lexed.length; i++) {
    const token = lexed[i];
    const padding = ' '.repeat(token.depth * tabLevel);
    tokenMaxLength = Math.max(tokenMaxLength, (padding.length + token.value.length));
  }

  const columns = ['token', 'definition', 'depth'];
  const generatePrintItem = (token) => {
    const padding = ' '.repeat(token.depth * tabLevel);
    const leftPaddedTokenString = `${padding}${token.value}`;
    const fullyPaddedTokenString = leftPaddedTokenString.padEnd(tokenMaxLength, ' ');

    const target = {};
    target[columns[0]] = fullyPaddedTokenString;
    target[columns[1]] = token.definition.toString();
    target[columns[2]] = token.depth.toString();
    return target;
  };
  const items = lexed.map((token) => generatePrintItem(token));

  if (tokens) {
    console.log(`Results of lexing (tokens: ["${tokens.join('", "')}"]):\n`);
  }
  printTableForItems(columns, 0, items);
};

exports.dictionary = dict;
exports.verifyReferencesAndDeclarations = verifyReferencesAndDeclarations;

// lex :: [String], Boolean -> [Lexed]
exports.lex = (tokens, debug = false) => {
  const definitionsAndIndices = tokens.map((token, index) => (
    {
      value: token,
      definition: defineToken(token),
      index,
    }
  ));

  const defsAndIndexes = reduce(depthReducer, [], definitionsAndIndices);

  // TODO Use an Either monad?
  const error = validateGroups(defsAndIndexes);
  if (error) {
    // TODO less throw, more Left of either
    throw new Error(error);
  }

  const lexed = refineWords(defsAndIndexes);

  checkFragments(lexed);

  if (debug) {
    printDebug(tokens, lexed);
  }

  return lexed;
};