const R = require('ramda');
const dict = require('../lib/lexer').dictionary;

const ARGUMENT_TYPE = {
  QUOTED: 'quoted',
  UNQUOTED: 'unquoted',
};

// Custom Types:
// Tree: see parser.js (can also have error: String)
// Node: see parser.js (can also have error: String)

// greaterThanZero :: [a] -> Boolean
const greaterThanZero = R.compose(R.gt(R.__, 0), R.length);

// isEmpty :: [a] -> Boolean
const isEmpty = R.anyPass([R.isNil, R.isEmpty]);

// hasKeys :: [String], a -> Boolean
const hasKeys = R.curry((keys, obj) => {
  return R.ifElse(
    greaterThanZero,
    () => R.pipe(R.find((k) => obj.hasOwnProperty(k)), R.complement(R.isNil))(keys),
    R.F,
  )(keys);
});

// keysChecker :: [[String]] -> Node -> Boolean
const keysChecker = (...listOfListsOfKeys) => {
  return R.anyPass([ ...R.map(hasKeys, listOfListsOfKeys) ]);
};

// isType :: String, Node -> Boolean
const isType = R.curry((type, node) => R.equals(type, R.prop('type', node)));

// isAnyType :: [String] -> Node -> Boolean
const isAnyType = (types) => R.anyPass(R.map(isType, types));

// isArgument :: Node -> Boolean
const isArgument = R.allPass([
  isAnyType([ARGUMENT_TYPE.QUOTED, ARGUMENT_TYPE.UNQUOTED]),
  keysChecker(['error'], ['type', 'value', 'name'])
]);

// isInlineFragment :: Node -> Boolean
const isInlineFragment = R.allPass([
  isType(dict.INLINE_FRAGMENT),
  keysChecker(['error'], ['name', 'type', 'children'])
]);

// isFragmentDeclaration :: Node -> Boolean
const isFragmentDeclaration = R.allPass([
  isType(dict.FRAGMENT_DECLARATION),
  keysChecker(['error'], ['name', 'typeReference', 'children'])
]);

// isQuery :: Node -> Boolean
const isQuery = R.allPass([
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
const valid = R.ifElse(R.curry(Array.isArray), greaterThanZero, R.complement(R.isNil));

// sanitize :: [a] -> [a]
const sanitize = R.ifElse(valid, R.filter(valid), R.always([]));

// isValidString :: String -> Boolean
const isValidString = R.allPass([
  R.compose(R.equals('String'), R.type),
  greaterThanZero
]);

// isInvalidString :: String -> Boolean
const isInvalidString = R.complement(isValidString);

// containsWhitespace :: String -> Boolean
const containsWhitespace = (string) => greaterThanZero(/\s/g.exec(string));

// hasError :: [a] -> Boolean
const hasError = R.compose(greaterThanZero, R.compose(R.filter, R.complement, R.propEq('error'))(undefined));

// assignErrorToObject :: String, a -> b
const assignErrorToObject = (error, object) => error ? R.mergeLeft({ error }, object) : object;

// argument :: String, String, Boolean -> Node
const argument = (name, value = null, isQuoted = false) => {
  const error = R.cond([
    [() => value !== null && isInvalidString(value), R.always('"value" of argument must be null or a string')],
    [() => isInvalidString(name),                    R.always('"name" of argument must be a non-empty string')],
    [() => containsWhitespace(name),                 R.always('name cannot contain whitespace')],
    [R.T,                                            R.always(undefined)],
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
const leaf = (name, ...arguments) => {
  const sanitized = sanitize(arguments);
  const validatedArguments = R.filter(isArgument, sanitized);
  const error = R.cond([
    [() => hasError(sanitized),                                       R.always('one or more argument nodes contains an error')],
    [() => R.not(R.eqProps('length', validatedArguments, sanitized)), R.always('received an invalid argument object')],
    [() => isInvalidString(name),                                     R.always('leaf requires a non-empty string for its name')],
    [() => containsWhitespace(name),                                  R.always('name cannot contain whitespace')],
    [R.T,                                                             R.always(undefined)],
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
  const error = R.cond([
    [() => isInvalidString(name),    R.always('branch name must be a non-empty string')],
    [() => containsWhitespace(name), R.always('name cannot contain whitespace')],
    [() => hasError(argumentsArray), R.always(`branch "${name}" has one or more arguments which have an error`)],
    [() => hasError(children),       R.always(`branch "${name}" has one or more child nodes which have an error`)],
    [() => isEmpty(children),        R.always(`branch "${name}" must have at least one child`)],
    [R.T,                            R.always(undefined)],
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
  const error = R.cond([
    [() => isInvalidString(name),                        R.always('fragment declaration requires a non-empty string for its name')],
    [() => containsWhitespace(name),                     R.always('name cannot contain whitespace')],
    [() => isInvalidString(typeReference),               R.always('fragment declaration requires a non-empty string for its typeReference')],
    [() => isEmpty(sanitized) || isEmpty(validChildren), R.always(`fragment declaration "${name}" requires at least one valid child node`)],
    [() => hasError(children),                           R.always(`fragment declaration "${name}" has one or more children which have an error`)],
    [R.T,                                                R.always(undefined)],
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
  const error = R.cond([
    [isInvalidString,    R.always('fragment reference requires a non-empty string')],
    [containsWhitespace, R.always('name cannot contain whitespace')],
    [R.T,                R.always(undefined)],
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
  const error = R.cond([
    [() => isInvalidString(name),                        R.always('inline fragment requires a non-empty string for its name')],
    [() => containsWhitespace(name),                     R.always('name cannot contain whitespace')],
    [() => isEmpty(sanitized) || isEmpty(validChildren), R.always(`inline fragment "${name}" requires at least one valid child node`)],
    [() => hasError(children),                           R.always(`inline fragment "${name}" has one or more children which have an error`)],
    [R.T,                                                R.always(undefined)],
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
  const children = R.pipe(
    R.filter(R.complement(isFragmentDeclaration)),
    sanitize
  )(nodes);
  const fragmentDeclarations = R.pipe(
    R.filter(isFragmentDeclaration),
    sanitize
  )(nodes);
  const error = R.cond([
    [() => isEmpty(nodes),                  R.always('query must receive at least one leaf or branch')],
    [() => R.find(isInlineFragment, nodes), R.always('query cannot receive an inline fragment as an argument')],
    [() => R.find(isQuery, nodes),          R.always('query cannot contain another query')],
    [() => hasError(children),              R.always('query has one or more children which have an error')],
    [() => hasError(fragmentDeclarations),  R.always('query has one or more fragmentDeclarations which have an error')],
    [R.T,                                   R.always(undefined)],
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
