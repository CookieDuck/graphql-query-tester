const parse = require('./parser').parse;
const dict = require('./lexer').dictionary;
const QUOTED = require('./structure').ARGUMENT_TYPE.QUOTED;
const R = require('ramda');

// Custom Types:
// Node: see parser.js
// Declaration: see parser.js

// isNilOrEmpty :: [a] -> Boolean
const isNilOrEmpty = R.anyPass([R.isNil, R.isEmpty]);

// isType :: String -> Node -> Boolean
const isType = type => node => R.equals(type, R.prop('type', node));

// isQuoted :: Node -> Boolean
const isQuoted= isType(QUOTED);

// isLeaf :: Node -> Boolean
const isLeaf = isType(dict.FIELD_LEAF);

// isBranch :: Node -> Boolean
const isBranch = isType(dict.FIELD_BRANCH);

// isInline :: Node -> Boolean
const isInline = isType(dict.INLINE_FRAGMENT);

// isFragment :: Node -> Boolean
const isFragment = isType(dict.FRAGMENT_NAME);

// parseDeclaration :: [String], Declaration -> [String]
const parseDeclaration = (accumulator, declaration) => R.unnest([
  ...accumulator,
  ` fragment ${declaration.name} on ${declaration.typeReference}`,
  ' { ',
  parseChildren(declaration.children),
  ' }',
]);

// parseDeclarations :: [Declaration] -> [Declaration]
const parseDeclarations = R.ifElse(isNilOrEmpty, R.always([]), R.reduce(parseDeclaration, []));

// parseChild :: [String], Node -> [String]
const parseChild = (accumulator, node) => R.unnest([
  R.ifElse(R.isEmpty, R.always([]), R.always([...accumulator, ' ']))(accumulator),
  R.cond([
    [isLeaf,     parseLeaf],
    [isBranch,   parseBranch],
    [isInline,   parseInlineFragment],
    [isFragment, parseFragment],
  ])(node),
]);

// parseChildren :: [Node] -> [String]
const parseChildren = R.ifElse(isNilOrEmpty, R.always([]), R.reduce(parseChild, []));

// parseLeaf :: Node -> [String]
const parseLeaf = node => R.unnest([
  R.prop('name', node),
  parseArguments(node.arguments),
]);

// parseBranch :: Node -> [String]
const parseBranch = node => R.unnest([
  R.prop('name', node),
  parseArguments(node.arguments),
  ' { ',
  parseChildren(node.children),
  ' }',
]);

// parseInlineFragment :: Node -> [String]
const parseInlineFragment = node => R.unnest([
  `... on ${node.name} { `,
  parseChildren(node.children),
  ' }',
]);

// parseFragment :: Node -> String
const parseFragment = node => `...${node.name}`;

//nparseArguments :: [Node] -> [String]
const parseArguments = args => R.ifElse(
  isNilOrEmpty,
  R.always([]),
  () => R.unnest([
    '(',
    // dropLast to remove the trailing comma left by parseArgument
    R.dropLast(1, R.reduce(parseArgument, [], args)),
    ')',
  ]),
)(args);

// parseArgument :: [String], Node -> [String]
const parseArgument = (accumulator, arg) => [
  ...accumulator,
  R.ifElse(
    isQuoted,
    R.always(`${arg.name}: "${arg.value}"`),
    R.always(`${arg.name}: ${arg.value}`))(arg),
  ', ',
];

const defaultOptions = {
  preserveOrder: true,
};

// format :: String, { preserveOrder: Boolean } -> String
exports.format = (str, options = defaultOptions) => {
  const ast = parse(str, options);
  return R.join('', R.unnest([
    '{ ',
    parseChildren(ast.children),
    ' }',
    parseDeclarations(ast.fragmentDeclarations),
  ]));
};
