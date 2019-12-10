const R = require('ramda');
const dict = require('../lib/lexer').dictionary;

const ARGUMENT_TYPE = {
  QUOTED: 'quoted',
  UNQUOTED: 'unquoted',
};

const greaterThanZero = R.compose(R.gt(R.__, 0), R.length);

const isEmpty = R.anyPass([R.isNil, R.isEmpty]);

const hasKeys = R.curry((keys, obj) => {
  return R.ifElse(
    greaterThanZero,
    () => R.pipe(R.find((k) => obj.hasOwnProperty(k)), R.complement(R.isNil))(keys),
    R.F,
  )(keys);
});

function keysChecker(...listOfListsOfKeys) {
  return R.anyPass([ ...R.map(hasKeys, listOfListsOfKeys) ]);
}

const isType = R.curry((type, node) => R.equals(type, R.prop('type', node)));

const isAnyType = R.curry((types, node) => R.anyPass(R.map(isType, types))(node));

function isArgument(node) {
  return R.allPass([
    isAnyType([ARGUMENT_TYPE.QUOTED, ARGUMENT_TYPE.UNQUOTED]),
    keysChecker(['error'], ['type', 'value', 'name'])
  ])(node);
}

function isInlineFragment(node) {
  return R.allPass([
    isType(dict.INLINE_FRAGMENT),
    keysChecker(['error'], ['name', 'type', 'children'])
  ])(node);
}

function isFragmentDeclaration(node) {
  return R.allPass([
    isType(dict.FRAGMENT_DECLARATION),
    keysChecker(['error'], ['name', 'typeReference', 'children'])
  ])(node);
}

function isQuery(node) {
  return R.allPass([
    isType(dict.QUERY),
    keysChecker(['error'], ['name', 'type', 'children'])
  ])(node);
}

function isValidChildForFragment(node) {
  return isAnyType([
    dict.FRAGMENT_DECLARATION,
    dict.INLINE_FRAGMENT,
    dict.FIELD_BRANCH,
    dict.FIELD_LEAF,
  ], node);
}

const valid = R.ifElse(R.curry(Array.isArray), greaterThanZero, R.complement(R.isNil));

const sanitize = R.ifElse(valid, R.filter(valid), R.always([]));

const isValidString = R.curry((str) => {
  return(R.allPass([
    R.compose(R.equals('String'), R.type),
    greaterThanZero])
  (str));
});

const isInvalidString = R.complement(isValidString);

function containsWhitespace(string) {
  return greaterThanZero(/\s/g.exec(string));
}

const hasError = R.compose(greaterThanZero, R.filter(R.complement(R.propEq('error', undefined))));

const assignErrorToObject = (error, object) => error ? R.mergeLeft({ error }, object) : object;

function argument(name, value = null, isQuoted = false) {
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
}

function leaf(name, ...arguments) {
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
}

function branchWithArguments(name, argumentsArray = [], ...children) {
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
}

function branch(name, ...children) {
  return branchWithArguments(name, [], ...children);
}

function fragmentDeclaration(name, typeReference, ...children) {
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
}

function fragment(name) {
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
}

function inlineFragment(name, ...children) {
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
}

function query(...nodes) {
  const children = R.pipe(
    R.filter(R.complement(isFragmentDeclaration)),
    sanitize
  )(nodes);
  const fragmentDeclarations = R.pipe(
    R.filter(isFragmentDeclaration),
    sanitize
  )(nodes);
  const error = R.cond([
    [() => isEmpty(nodes), R.always('query must receive at least one leaf or branch')],
    [() => R.find(isInlineFragment, nodes), R.always('query cannot receive an inline fragment as an argument')],
    [() => R.find(isQuery, nodes), R.always('query cannot contain another query')],
    [() => hasError(children), R.always('query has one or more children which have an error')],
    [() => hasError(fragmentDeclarations), R.always('query has one or more fragmentDeclarations which have an error')],
    [R.T,                                                R.always(undefined)],
  ])();

  const node = {
    type: dict.QUERY,
    name: 'root',
    children,
    fragmentDeclarations,
  };
  return assignErrorToObject(error, node);
}

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
