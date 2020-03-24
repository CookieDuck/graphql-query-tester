const printTableForItems = require('./util').printTableForItems;

const R = require('ramda');

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
const isType = (type) => R.propEq('definition', type);

// all these dict helpers :: Lexed -> Boolean
const isWord = isType(dict.WORD);
const isNotWord = R.compose(R.not, isWord);
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
  const lastItemInAccumulator = R.ifElse(R.isNil, R.always({}), R.identity)(R.last(accumulator));
  const depthOfLastItemInAccumulator = depthOfLast(accumulator);
  const getCurrentDepth = R.cond([
    [() => isGroupStart(lastItemInAccumulator), R.always(R.inc(depthOfLastItemInAccumulator))],
    [() => isGroupEnd(current),                 R.always(R.dec(depthOfLastItemInAccumulator))],
    [R.T,                                       R.always(depthOfLastItemInAccumulator)],
  ]);
  return [
    ...accumulator,
    R.assoc('depth', getCurrentDepth(), current)
  ];
};

// depthOfLast = [Lexed] -> Integer
const depthOfLast = R.compose(R.propOr(0, 'depth'), R.last);

// validateGroups :: [Lexed] -> String or Null
const validateGroups = (lexed) => {
  const groupStarts = lexed.filter(isGroupStart).length;
  const groupEnds = lexed.filter(isGroupEnd).length;
  return R.cond([
    [R.equals(groupEnds), R.always(null)],
    [R.gt(groupEnds),     R.always(`Syntax error: Found ${groupEnds} '}' but only ${groupStarts} '{'`)],
    [R.T,                 R.always(`Syntax error: Found ${groupStarts} '{' but only ${groupEnds} '}'`)],
  ])(groupStarts);
};

// checkWord :: String -> Boolean
const checkWord = (str) => /\w/.test(str);

// defineToken :: String -> String
const defineToken = R.cond([
  [R.equals('{'),        R.always(dict.GROUP_START)],
  [R.equals('}'),        R.always(dict.GROUP_END)],
  [R.equals('('),        R.always(dict.ARGUMENT_START)],
  [R.equals(')'),        R.always(dict.ARGUMENT_END)],
  [R.equals(':'),        R.always(dict.COLON)],
  [R.equals('"'),        R.always(dict.QUOTES)],
  [R.equals(','),        R.always(dict.COMMA)],
  [R.equals('...'),      R.always(dict.ELLIPSIS)],
  [R.equals('on'),       R.always(dict.ON_KEYWORD)],
  [R.equals('fragment'), R.always(dict.FRAGMENT_KEYWORD)],
  [checkWord,            R.always(dict.WORD)],
  [R.T,                  R.always(null)],
]);

// refineWords :: [Lexed] -> Void
const refineWords = (input) => {
  const next = R.compose(R.prop(R.__, input), R.inc, R.prop('index'));
  const prev = R.compose(R.prop(R.__, input), R.dec, R.prop('index'));
  const assocDef = R.assoc('definition');
  const assocArgumentNode = (node) => {
    const argumentEnd = R.head(input.slice(R.prop('index', node)).filter(isArgumentEnd));
    const definition = argumentEnd && isGroupStart(input[R.inc(argumentEnd.index)]) ?
      dict.FIELD_BRANCH :
      dict.FIELD_LEAF;
    return assocDef(definition)(node);
  };

  return input.map(
    R.cond([
      [isNotWord,                          R.identity],
      [R.compose(isColon, next),           assocDef(dict.ARGUMENT_NAME)],
      [R.compose(isQuotes, prev),          assocDef(dict.ARGUMENT_VALUE)],
      [R.compose(isColon, prev),           assocDef(dict.ARGUMENT_VALUE)],
      [R.compose(isEllipsis, prev),        assocDef(dict.FRAGMENT_NAME)],
      [R.compose(isFragmentKeyword, prev), assocDef(dict.FRAGMENT_DECLARATION)],
      [R.compose(isOnKeyword, prev),       assocDef(dict.FRAGMENT_TYPE_NAME)],
      [R.compose(isGroupStart, next),      assocDef(dict.FIELD_BRANCH)],
      [R.compose(isArgumentStart, next),   assocArgumentNode],
      [R.T,                                assocDef(dict.FIELD_LEAF)],
    ])
  );
};

// getPropAfterFilter :: String, fn -> fn
const getPropAfterFilter = R.curry((prop, filterFn) => R.pipe(R.filter(filterFn), R.map(R.prop(prop))));

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
  printTableForItems(columns, items);
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

  const defsAndIndexes = R.reduce(depthReducer, [], definitionsAndIndices);

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