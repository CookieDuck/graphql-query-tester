'use strict';

const parse = require('./parser').parse;
const dict = require('./lexer').dictionary;
const QUOTED = require('./structure').ARGUMENT_TYPE.QUOTED;
const {
  always,
  anyPass,
  cond,
  dropLast,
  equals,
  ifElse,
  isEmpty,
  isNil,
  join,
  prop,
  reduce,
  unnest,
} = require('ramda');

// Custom Types:
// Node: see parser.js
// Declaration: see parser.js

// isNilOrEmpty :: [a] -> Boolean
const isNilOrEmpty = anyPass([isNil, isEmpty]);

// isType :: String -> Node -> Boolean
const isType = type => node => equals(type, prop('type', node));

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
const parseDeclaration = (accumulator, declaration) => unnest([
  ...accumulator,
  ` fragment ${declaration.name} on ${declaration.typeReference}`,
  ' { ',
  parseChildren(declaration.children),
  ' }',
]);

// parseDeclarations :: [Declaration] -> [Declaration]
const parseDeclarations = ifElse(isNilOrEmpty, always([]), reduce(parseDeclaration, []));

// parseChild :: [String], Node -> [String]
const parseChild = (accumulator, node) => unnest([
  ifElse(isEmpty, always([]), always([...accumulator, ' ']))(accumulator),
  cond([
    [isLeaf,     parseLeaf],
    [isBranch,   parseBranch],
    [isInline,   parseInlineFragment],
    [isFragment, parseFragment],
  ])(node),
]);

// parseChildren :: [Node] -> [String]
const parseChildren = ifElse(isNilOrEmpty, always([]), reduce(parseChild, []));

// parseLeaf :: Node -> [String]
const parseLeaf = node => unnest([
  prop('name', node),
  parseArguments(node.arguments),
]);

// parseBranch :: Node -> [String]
const parseBranch = node => unnest([
  prop('name', node),
  parseArguments(node.arguments),
  ' { ',
  parseChildren(node.children),
  ' }',
]);

// parseInlineFragment :: Node -> [String]
const parseInlineFragment = node => unnest([
  `... on ${node.name} { `,
  parseChildren(node.children),
  ' }',
]);

// parseFragment :: Node -> String
const parseFragment = node => `...${node.name}`;

//nparseArguments :: [Node] -> [String]
const parseArguments = args => ifElse(
  isNilOrEmpty,
  always([]),
  () => unnest([
    '(',
    // dropLast to remove the trailing comma left by parseArgument
    dropLast(1, reduce(parseArgument, [], args)),
    ')',
  ]),
)(args);

// parseArgument :: [String], Node -> [String]
const parseArgument = (accumulator, arg) => [
  ...accumulator,
  ifElse(
    isQuoted,
    always(`${arg.name}: "${arg.value}"`),
    always(`${arg.name}: ${arg.value}`))(arg),
  ', ',
];

const defaultOptions = {
  preserveOrder: true,
};

// format :: String, { preserveOrder: Boolean } -> String
exports.format = (str, options = defaultOptions) => {
  const ast = parse(str, options);
  return join('', unnest([
    '{ ',
    parseChildren(ast.children),
    ' }',
    parseDeclarations(ast.fragmentDeclarations),
  ]));
};
