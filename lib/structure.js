'use strict';

const {
  always,
  allPass,
  anyPass,
  complement,
  compose,
  cond,
  curry,
  equals,
  eqProps,
  filter,
  find,
  F,
  ifElse,
  isEmpty,
  isNil,
  map,
  mergeLeft,
  not,
  pipe,
  prop,
  propEq,
  type,
  T,
} = require('ramda');
const dict = require('../lib/lexer').dictionary;
const { greaterThanZero } = require('./util');

const ARGUMENT_TYPE = {
  QUOTED: 'quoted',
  UNQUOTED: 'unquoted',
};

// Custom Types:
// Tree: see parser.js (can also have error: String)
// Node: see parser.js (can also have error: String)

// hasKeys :: [String], a -> Boolean
const hasKeys = curry((keys, obj) => {
  return ifElse(
    greaterThanZero,
    () => pipe(find((k) => obj.hasOwnProperty(k)), complement(isNil))(keys),
    F,
  )(keys);
});

// keysChecker :: [[String]] -> Node -> Boolean
const keysChecker = (...listOfListsOfKeys) => {
  return anyPass([ ...map(hasKeys, listOfListsOfKeys) ]);
};

// isType :: String, Node -> Boolean
const isType = curry((type, node) => equals(type, prop('type', node)));

// isAnyType :: [String] -> Node -> Boolean
const isAnyType = (types) => anyPass(map(isType, types));

// isArgument :: Node -> Boolean
const isArgument = allPass([
  isAnyType([ARGUMENT_TYPE.QUOTED, ARGUMENT_TYPE.UNQUOTED]),
  keysChecker(['error'], ['type', 'value', 'name'])
]);

// isInlineFragment :: Node -> Boolean
const isInlineFragment = allPass([
  isType(dict.INLINE_FRAGMENT),
  keysChecker(['error'], ['name', 'type', 'children'])
]);

// isFragmentDeclaration :: Node -> Boolean
const isFragmentDeclaration = allPass([
  isType(dict.FRAGMENT_DECLARATION),
  keysChecker(['error'], ['name', 'typeReference', 'children'])
]);

// isQuery :: Node -> Boolean
const isQuery = allPass([
  isType(dict.QUERY),
  keysChecker(['error'], ['name', 'type', 'children'])
]);

// isValidChildForFragment :: Node -> Boolean
const isValidChildForFragment = isAnyType([
  dict.FRAGMENT_DECLARATION,
  dict.INLINE_FRAGMENT,
  dict.FIELD_BRANCH,
  dict.FIELD_LEAF,
]);

// valid :: [a] -> Boolean
const valid = ifElse(curry(Array.isArray), greaterThanZero, complement(isNil));

// sanitize :: [a] -> [a]
const sanitize = ifElse(valid, filter(valid), always([]));

// isValidString :: String -> Boolean
const isValidString = allPass([
  compose(equals('String'), type),
  greaterThanZero
]);

// isInvalidString :: String -> Boolean
const isInvalidString = complement(isValidString);

// containsWhitespace :: String -> Boolean
const containsWhitespace = (string) => greaterThanZero(/\s/g.exec(string));

// hasError :: [a] -> Boolean
const hasError = compose(greaterThanZero, compose(filter, complement,propEq('error'))(undefined));

// assignErrorToObject :: String, a -> b
const assignErrorToObject = (error, object) => error ? mergeLeft({ error }, object) : object;

// argument :: String, String, Boolean -> Node
const argument = (name, value = null, isQuoted = false) => {
  const error = cond([
    [() => value !== null && isInvalidString(value), always('"value" of argument must be null or a string')],
    [() => isInvalidString(name),                    always('"name" of argument must be a non-empty string')],
    [() => containsWhitespace(name),                 always('name cannot contain whitespace')],
    [T,                                              always(undefined)],
  ])();
  const type = isQuoted ? ARGUMENT_TYPE.QUOTED : ARGUMENT_TYPE.UNQUOTED;

  const node = {
    name,
    value,
    type,
  };
  return assignErrorToObject(error, node);
};

// leaf :: String, [Node] -> Node
const leaf = (name, ...argumentNodes) => {
  const sanitized = sanitize(argumentNodes);
  const validatedArguments = filter(isArgument, sanitized);
  const error = cond([
    [() => hasError(sanitized),                                   always('one or more argument nodes contains an error')],
    [() => not(eqProps('length', validatedArguments, sanitized)), always('received an invalid argument object')],
    [() => isInvalidString(name),                                 always('leaf requires a non-empty string for its name')],
    [() => containsWhitespace(name),                              always('name cannot contain whitespace')],
    [T,                                                           always(undefined)],
  ])();

  const node = {
    type: dict.FIELD_LEAF,
    name,
    arguments: validatedArguments,
  };
  return assignErrorToObject(error, node);
};

// branchWithArguments :: String, [Node], [Node] -> Node
const branchWithArguments = (name, argumentsArray = [], ...children) => {
  const error = cond([
    [() => isInvalidString(name),    always('branch name must be a non-empty string')],
    [() => containsWhitespace(name), always('name cannot contain whitespace')],
    [() => hasError(argumentsArray), always(`branch "${name}" has one or more arguments which have an error`)],
    [() => hasError(children),       always(`branch "${name}" has one or more child nodes which have an error`)],
    [() => isEmpty(children),        always(`branch "${name}" must have at least one child`)],
    [T,                              always(undefined)],
  ])();

  const node = {
    type: dict.FIELD_BRANCH,
    name,
    children,
    arguments: argumentsArray,
  };
  return assignErrorToObject(error, node);
};

// branch :: String, [Node] -> Node
const branch = (name, ...children) => {
  return branchWithArguments(name, [], ...children);
};

// fragmentDeclaration :: String, String, [Node] -> Node
const fragmentDeclaration = (name, typeReference, ...children) => {
  const sanitized = sanitize(children);
  const validChildren = sanitized.filter(isValidChildForFragment);
  const error = cond([
    [() => isInvalidString(name),                        always('fragment declaration requires a non-empty string for its name')],
    [() => containsWhitespace(name),                     always('name cannot contain whitespace')],
    [() => isInvalidString(typeReference),               always('fragment declaration requires a non-empty string for its typeReference')],
    [() => isEmpty(sanitized) || isEmpty(validChildren), always(`fragment declaration "${name}" requires at least one valid child node`)],
    [() => hasError(children),                           always(`fragment declaration "${name}" has one or more children which have an error`)],
    [T,                                                  always(undefined)],
  ])();

  const node = {
    type: dict.FRAGMENT_DECLARATION,
    name,
    typeReference,
    children: sanitized,
  };
  return assignErrorToObject(error, node);
};

// fragment :: String -> Node
const fragment = (name) => {
  const error = cond([
    [isInvalidString,    always('fragment reference requires a non-empty string')],
    [containsWhitespace, always('name cannot contain whitespace')],
    [T,                  always(undefined)],
  ])(name);

  const node = {
    type: dict.FRAGMENT_NAME,
    name,
  };
  return assignErrorToObject(error, node);
};

// inlineFragment :: String, [Node] -> Node
const inlineFragment = (name, ...children) => {
  const sanitized = sanitize(children);
  const validChildren = sanitized.filter(isValidChildForFragment);
  const error = cond([
    [() => isInvalidString(name),                        always('inline fragment requires a non-empty string for its name')],
    [() => containsWhitespace(name),                     always('name cannot contain whitespace')],
    [() => isEmpty(sanitized) || isEmpty(validChildren), always(`inline fragment "${name}" requires at least one valid child node`)],
    [() => hasError(children),                           always(`inline fragment "${name}" has one or more children which have an error`)],
    [T,                                                  always(undefined)],
  ])();

  const node = {
    type: dict.INLINE_FRAGMENT,
    name,
    children: sanitized,
  };
  return assignErrorToObject(error, node);
};

// query :: [Node] -> Tree
const query = (...nodes) => {
  const children = pipe(
    filter(complement(isFragmentDeclaration)),
    sanitize
  )(nodes);
  const fragmentDeclarations = pipe(
    filter(isFragmentDeclaration),
    sanitize
  )(nodes);
  const error = cond([
    [() => isEmpty(nodes),                 always('query must receive at least one leaf or branch')],
    [() => find(isInlineFragment, nodes),  always('query cannot receive an inline fragment as an argument')],
    [() => find(isQuery, nodes),           always('query cannot contain another query')],
    [() => hasError(children),             always('query has one or more children which have an error')],
    [() => hasError(fragmentDeclarations), always('query has one or more fragmentDeclarations which have an error')],
    [T,                                    always(undefined)],
  ])();

  const tree = {
    type: dict.QUERY,
    name: 'root',
    children,
    fragmentDeclarations,
  };
  return assignErrorToObject(error, tree);
};

exports.ARGUMENT_TYPE = ARGUMENT_TYPE;
exports.argument = argument;
exports.leaf = leaf;
exports.branchWithArguments = branchWithArguments;
exports.branch = branch;
exports.fragmentDeclaration = fragmentDeclaration;
exports.fragment = fragment;
exports.inlineFragment = inlineFragment;
exports.query = query;

// aliases for those who like it TERSE
exports.a = argument;
exports.l = leaf;
exports.ba = branchWithArguments;
exports.b = branch;
exports.fd = fragmentDeclaration;
exports.f = fragment;
exports.i = inlineFragment;
exports.q = query;
