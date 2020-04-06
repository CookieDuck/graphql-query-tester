const R = require('ramda');

const parse = require('./parser').parse;
const { ARGUMENT_TYPE } = require('./structure');
const { greaterThanZero, greaterThanOne } = require('./util');

const PATH_DELIMITER = '.';

// Custom Types:
// Tree: see parser.js

// errorProp :: a -> b
const errorProp = R.prop('error');

// treeProp :: a -> b
const treeProp = R.prop('tree');

// recursiveParse :: [String], [String], Tree -> Tree
const recursiveParse = R.curry((traversedPath, nodeNames, tree) => {
  const firstNodeName = R.head(nodeNames);
  const subtree = getSubtreeAtNodeName(traversedPath, firstNodeName, tree);

  const pathRemainingAndHasNoError = R.compose(R.and(greaterThanOne(nodeNames)), R.isNil, errorProp);

  const partiallyAppliedRecursiveParse = recursiveParse(
    R.concat(traversedPath, [ firstNodeName ]),
    R.drop(1, nodeNames),
  );
  const parseSubTree = R.compose(partiallyAppliedRecursiveParse, treeProp);

  return R.ifElse(pathRemainingAndHasNoError, parseSubTree, R.identity)(subtree);
});

// walkTree :: [String], Tree -> Tree
const walkTree = recursiveParse([]);

// getSubtreeAtNodeName :: [String], String, Tree -> { Tree, String }
const getSubtreeAtNodeName = R.curry((traversedPath, nodeName, tree) => {
  const subtree =  R.find(
    R.compose(R.equals(nodeName), R.prop('name')),
    R.propOr([], 'children', tree),
  );
  return {
    tree: subtree,
    error: subtree ? null : `${nodeName} does not exist at path: ${R.join(PATH_DELIMITER, traversedPath)}`,
  };
});

// errorOrResult :: Tree, String, Function -> Tree OR String
const errorOrResult = R.curry((tree, path, onSuccessFn) =>
  R.ifElse(errorProp, errorProp, onSuccessFn)(walkTree(R.split(PATH_DELIMITER, path), tree))
);

// sortNodesByName :: String -> Tree -> [Node]
const sortNodesByName = (propName) => R.pipe(R.propOr([], propName), R.sortBy(R.prop('name')));

// sortedTree :: Tree -> Tree
const sortedTreeWithArgWipe = (tree) =>
  Object.assign(
    {},
    tree,
    R.applySpec({
      children: R.pipe(sortNodesByName('children'), R.map(sortedTreeWithArgWipe)),
      arguments: R.pipe(sortNodesByName('arguments'), R.map(R.omit(['value']))),
      fragmentDeclarations: R.pipe(sortNodesByName('fragmentDeclarations'), R.map(sortedTreeWithArgWipe)),
    })(tree)
  );

// pathsOfChildren :: [String], Node -> [String]
const pathsOfChildren = R.curry((traversedPath, node) =>
  R.pipe(
    R.propOr([], 'children'),
    R.map(findArgumentPath(traversedPath)),
    R.unnest
  )(node)
);

// findArgumentPath :: [String], Node -> [String]
const findArgumentPath = R.curry((traversedPath, node) => {
  const hasArguments = R.compose(greaterThanZero, R.propOr([], 'arguments'))(node);
  const myPath = [...traversedPath, R.prop('name', node)];

  return R.concat(
    hasArguments ? [ R.join(PATH_DELIMITER, myPath) ] : [],
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
      const matchingStructureArg = R.find(R.propEq('name', R.prop('name', queryArg)), argsAtPathOfStructure);
      const accumulateError = (str) => R.always(R.concat(innerAccumulator, [str]));
      return R.cond([
        [() => R.isNil(matchingStructureArg),     accumulateError(`Structure is missing argument '${R.prop('name', queryArg)}' at path ${path}`)],
        [R.eqProps('type', matchingStructureArg), R.always(innerAccumulator)], // arg type equals; no error to accumulate
        [R.propEq('type', ARGUMENT_TYPE.QUOTED),  accumulateError(`Argument '${R.prop('name', queryArg)}' at path ${path} is quoted in GraphQL, but not structure`)],
        [R.T,                                     accumulateError(`Argument '${R.prop('name', queryArg)}' at path ${path} is quoted in structure, but not GraphQL`)],
      ])(queryArg);
    };

    return [
      ...outerAccumulator,
      ...R.reduce(innerReducer, [], argsAtPathOfQuery),
    ];
  };

  // function that checks for args in structure that aren't present in query
  const structureReducer = (outerAccumulator, path) => {
    const argsAtPathOfQuery = argumentsAtPathOfTree(query, path);
    const argsAtPathOfStructure = argumentsAtPathOfTree(structure, path);

    const innerReducer = (innerAccumulator, structureArg) => {
      return R.ifElse(
        R.isNil,
        R.always(R.concat(innerAccumulator, [
          `Query is missing argument '${R.prop('name', structureArg)}' at path ${path}`])
        ),
        R.always(innerAccumulator),
      )(R.find(R.propEq('name', R.prop('name', structureArg)), argsAtPathOfQuery));
    };

    return [
      ...outerAccumulator,
      ...R.reduce(innerReducer, [], argsAtPathOfStructure)
    ];
  };

  // function that checks for nodes present in sot (source of truth) but absent from other
  const walkAndAggregateErrors = R.curry((traversedPath, prefix, sot, other) => {
    const sotChildren = R.propOr([], 'children', sot);
    const otherChildren = R.propOr([], 'children', other);

    const reducer = (accumulator, current) => {
      const sotName = R.prop('name', current);
      const otherChild = R.find(R.propEq('name', sotName), otherChildren);
      return R.ifElse(
        R.isNil,
        R.always(R.concat(accumulator, [
          `${prefix} is missing node: '${sotName}' at path ${R.join(PATH_DELIMITER, traversedPath)}`
        ])),
        R.compose(
          R.concat(accumulator),
          R.unnest,
          walkAndAggregateErrors(R.concat(traversedPath, [sotName]), prefix, current),
        )
      )(otherChild);
    };

    return R.compose(R.unnest, R.reduce(reducer, []))(sotChildren);
  });

  return[
    ...R.reduce(queryReducer, [], findArgumentPaths(query)),
    ...R.reduce(structureReducer, [], findArgumentPaths(structure)),
    ...walkAndAggregateErrors([], 'Structure', query, structure),
    ...walkAndAggregateErrors([], 'Query', structure, query),
  ];
};

// argumentsAtPath :: String, String -> Tree OR String
const argumentsAtPath = R.curry((query, path) => argumentsAtPathOfTree(parse(query), path));

// argumentsAtPathOfTree :: Tree, String -> Tree OR String
const argumentsAtPathOfTree = R.curry((tree, path) =>
  errorOrResult(tree, path, R.compose(R.propOr([], 'arguments'), treeProp))
);

// treeAtPath :: String, String -> Tree OR String
const treeAtPath = (query, path) => errorOrResult(parse(query), path, treeProp);

// findErrors :: String, Tree -> [String]
const findErrors = (query, structure) => {
  const sortedQuery = R.compose(sortedTreeWithArgWipe, parse)(query);
  const sortedStructure = sortedTreeWithArgWipe(structure);

  const parseErrors = R.unnest([
    R.ifElse(R.prop('error'), R.prop('error'), R.always([]))(sortedQuery),
    R.ifElse(R.prop('error'), R.prop('error'), R.always([]))(sortedStructure),
  ]);

  return R.ifElse(
    R.isEmpty,
    R.always(findErrorsFromPaths(sortedQuery, sortedStructure)),
    R.identity,
  )(parseErrors);
};

// queryHasStructure :: String, Tree -> Boolean
const queryHasStructure = (query, structure) =>
  R.compose(R.equals(0), R.prop('length'))(findErrors(query, structure));

module.exports = {
  argumentsAtPath,
  queryHasStructure,
  findErrors,
  treeAtPath,
};