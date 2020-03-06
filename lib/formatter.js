const parse = require('./parser').parse;
const dict = require('./lexer').dictionary;
const QUOTED = require('./structure').ARGUMENT_TYPE.QUOTED;
const R = require('ramda');

const isNilOrEmpty = R.anyPass([R.isNil, R.isEmpty]);

const isType = type => node => R.equals(type, R.prop('type', node));
const isQuoted= isType(QUOTED);
const isLeaf = isType(dict.FIELD_LEAF);
const isBranch = isType(dict.FIELD_BRANCH);
const isInline = isType(dict.INLINE_FRAGMENT);
const isFragment = isType(dict.FRAGMENT_NAME);

const parseDeclaration = (accumulator, declaration) => R.unnest([
  ...accumulator,
  ` fragment ${declaration.name} on ${declaration.typeReference}`,
  ' { ',
  parseChildren(declaration.children),
  ' }',
]);

const parseDeclarations = R.ifElse(isNilOrEmpty, R.always([]), R.reduce(parseDeclaration, []));

const parseChild = (accumulator, node) => R.unnest([
  R.ifElse(R.isEmpty, R.always([]), R.always([...accumulator, ' ']))(accumulator),
  R.cond([
    [isLeaf,     parseLeaf],
    [isBranch,   parseBranch],
    [isInline,   parseInlineFragment],
    [isFragment, parseFragment],
  ])(node),
]);

const parseChildren = R.ifElse(isNilOrEmpty, R.always([]), R.reduce(parseChild, []));

const parseLeaf = node => R.unnest([
  R.prop('name', node),
  parseArguments(node.arguments),
]);

const parseBranch = node => R.unnest([
  R.prop('name', node),
  parseArguments(node.arguments),
  ' { ',
  parseChildren(node.children),
  ' }',
]);

const parseInlineFragment = node => R.unnest([
  `... on ${node.name} { `,
  parseChildren(node.children),
  ' }',
]);

const parseFragment = node => `...${node.name}`;

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

const parseArgument = (accumulator, arg) => [
  ...accumulator,
  R.ifElse(
    isQuoted,
    R.always(`${arg.name}: "${arg.value}"`),
    R.always(`${arg.name}: ${arg.value}`))(arg),
  ', ',
];

exports.format = function(str) {
  const ast = parse(str);
  return R.join('', R.unnest([
    '{ ',
    parseChildren(ast.children),
    ' }',
    parseDeclarations(ast.fragmentDeclarations),
  ]));
};
