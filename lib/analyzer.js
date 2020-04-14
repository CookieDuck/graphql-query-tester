'use strict';

const {
  always,
  applySpec,
  and,
  compose,
  concat,
  cond,
  curry,
  drop,
  equals,
  eqProps,
  find,
  identity,
  ifElse,
  isEmpty,
  isNil,
  join,
  head,
  map,
  omit,
  pipe,
  prop,
  propEq,
  propOr,
  reduce,
  sortBy,
  split,
  T,
  unnest,
} = require('ramda');

const parse = require('./parser').parse;
const { ARGUMENT_TYPE } = require('./structure');
const { greaterThanZero, greaterThanOne } = require('./util');

const PATH_DELIMITER = '.';

// Custom Types:
// Tree: see parser.js

// errorProp :: a -> b
const errorProp = prop('error');

// treeProp :: a -> b
const treeProp = prop('tree');

// recursiveParse :: [String], [String], Tree -> Tree
const recursiveParse = curry((traversedPath, nodeNames, tree) => {
  const firstNodeName = head(nodeNames);
  const subtree = getSubtreeAtNodeName(traversedPath, firstNodeName, tree);

  const pathRemainingAndHasNoError = compose(and(greaterThanOne(nodeNames)), isNil, errorProp);

  const partiallyAppliedRecursiveParse = recursiveParse(
    concat(traversedPath, [ firstNodeName ]),
    drop(1, nodeNames),
  );
  const parseSubTree = compose(partiallyAppliedRecursiveParse, treeProp);

  return ifElse(pathRemainingAndHasNoError, parseSubTree, identity)(subtree);
});

// walkTree :: [String], Tree -> Tree
const walkTree = recursiveParse([]);

// getSubtreeAtNodeName :: [String], String, Tree -> { Tree, String }
const getSubtreeAtNodeName = curry((traversedPath, nodeName, tree) => {
  const subtree =  find(
    compose(equals(nodeName), prop('name')),
    propOr([], 'children', tree),
  );
  return {
    tree: subtree,
    error: subtree ? null : `${nodeName} does not exist at path: ${join(PATH_DELIMITER, traversedPath)}`,
  };
});

// errorOrResult :: Tree, String, Function -> Tree OR String
const errorOrResult = curry((tree, path, onSuccessFn) =>
  ifElse(errorProp, errorProp, onSuccessFn)(walkTree(split(PATH_DELIMITER, path), tree))
);

// sortNodesByName :: String -> Tree -> [Node]
const sortNodesByName = (propName) => pipe(propOr([], propName), sortBy(prop('name')));

// sortedTree :: Tree -> Tree
const sortedTreeWithArgWipe = (tree) =>
  Object.assign(
    {},
    tree,
    applySpec({
      children: pipe(sortNodesByName('children'), map(sortedTreeWithArgWipe)),
      arguments: pipe(sortNodesByName('arguments'), map(omit(['value']))),
      fragmentDeclarations: pipe(sortNodesByName('fragmentDeclarations'), map(sortedTreeWithArgWipe)),
    })(tree)
  );

// pathsOfChildren :: [String], Node -> [String]
const pathsOfChildren = curry((traversedPath, node) =>
  pipe(
    propOr([], 'children'),
    map(findArgumentPath(traversedPath)),
    unnest
  )(node)
);

// findArgumentPath :: [String], Node -> [String]
const findArgumentPath = curry((traversedPath, node) => {
  const hasArguments = compose(greaterThanZero, propOr([], 'arguments'))(node);
  const myPath = [...traversedPath, prop('name', node)];

  return concat(
    hasArguments ? [ join(PATH_DELIMITER, myPath) ] : [],
    pathsOfChildren(myPath, node)
  );
});

// findArgumentPaths :: Tree -> [String]
const findArgumentPaths = pathsOfChildren([]);

// findErrorsFromPaths :: Tree, Tree -> [String]
const findErrorsFromPaths = (query, structure) => {
  // function that checks for args in query that aren't present in structure,
  // as well as args in query that are present in structure, but have type mismatches
  const queryReducer = (outerAccumulator, path) => {
    const argsAtPathOfQuery = argumentsAtPathOfTree(query, path);
    const argsAtPathOfStructure = argumentsAtPathOfTree(structure, path);

    const innerReducer = (innerAccumulator, queryArg) => {
      const matchingStructureArg = find(propEq('name', prop('name', queryArg)), argsAtPathOfStructure);
      const accumulateError = (str) => always(concat(innerAccumulator, [str]));
      return cond([
        [() => isNil(matchingStructureArg),     accumulateError(`Structure is missing argument '${prop('name', queryArg)}' at path ${path}`)],
        [eqProps('type', matchingStructureArg), always(innerAccumulator)], // arg type equals; no error to accumulate
        [propEq('type', ARGUMENT_TYPE.QUOTED),  accumulateError(`Argument '${prop('name', queryArg)}' at path ${path} is quoted in GraphQL, but not structure`)],
        [T,                                     accumulateError(`Argument '${prop('name', queryArg)}' at path ${path} is quoted in structure, but not GraphQL`)],
      ])(queryArg);
    };

    return [
      ...outerAccumulator,
      ...reduce(innerReducer, [], argsAtPathOfQuery),
    ];
  };

  // function that checks for args in structure that aren't present in query
  const structureReducer = (outerAccumulator, path) => {
    const argsAtPathOfQuery = argumentsAtPathOfTree(query, path);
    const argsAtPathOfStructure = argumentsAtPathOfTree(structure, path);

    const innerReducer = (innerAccumulator, structureArg) => {
      return ifElse(
        isNil,
        always(concat(innerAccumulator, [
          `Query is missing argument '${prop('name', structureArg)}' at path ${path}`])
        ),
        always(innerAccumulator),
      )(find(propEq('name', prop('name', structureArg)), argsAtPathOfQuery));
    };

    return [
      ...outerAccumulator,
      ...reduce(innerReducer, [], argsAtPathOfStructure)
    ];
  };

  // function that checks for nodes present in sot (source of truth) but absent from other
  const walkAndAggregateErrors = curry((traversedPath, prefix, sot, other) => {
    const sotChildren = propOr([], 'children', sot);
    const otherChildren = propOr([], 'children', other);

    const reducer = (accumulator, current) => {
      const sotName = prop('name', current);
      const otherChild = find(propEq('name', sotName), otherChildren);
      return ifElse(
        isNil,
        always(concat(accumulator, [
          `${prefix} is missing node: '${sotName}' at path ${join(PATH_DELIMITER, traversedPath)}`
        ])),
        compose(
          concat(accumulator),
          unnest,
          walkAndAggregateErrors(concat(traversedPath, [sotName]), prefix, current),
        )
      )(otherChild);
    };

    return compose(unnest, reduce(reducer, []))(sotChildren);
  });

  return[
    ...reduce(queryReducer, [], findArgumentPaths(query)),
    ...reduce(structureReducer, [], findArgumentPaths(structure)),
    ...walkAndAggregateErrors([], 'Structure', query, structure),
    ...walkAndAggregateErrors([], 'Query', structure, query),
  ];
};

// argumentsAtPath :: String, String -> Tree OR String
const argumentsAtPath = curry((query, path) => argumentsAtPathOfTree(parse(query), path));

// argumentsAtPathOfTree :: Tree, String -> Tree OR String
const argumentsAtPathOfTree = curry((tree, path) =>
  errorOrResult(tree, path, compose(propOr([], 'arguments'), treeProp))
);

// treeAtPath :: String, String -> Tree OR String
const treeAtPath = (query, path) => errorOrResult(parse(query), path, treeProp);

// findErrors :: String, Tree -> [String]
const findErrors = (query, structure) => {
  const sortedQuery = compose(sortedTreeWithArgWipe, parse)(query);
  const sortedStructure = sortedTreeWithArgWipe(structure);

  const parseErrors = unnest([
    ifElse(errorProp, errorProp, always([]))(sortedQuery),
    ifElse(errorProp, errorProp, always([]))(sortedStructure),
  ]);

  return ifElse(
    isEmpty,
    always(findErrorsFromPaths(sortedQuery, sortedStructure)),
    identity,
  )(parseErrors);
};

// queryHasStructure :: String, Tree -> Boolean
const queryHasStructure = (query, structure) =>
  compose(equals(0), prop('length'))(findErrors(query, structure));

module.exports = {
  argumentsAtPath,
  queryHasStructure,
  findErrors,
  treeAtPath,
};