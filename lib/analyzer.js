const R = require('ramda');

const parse = require('./parser').parse;

const PATH_DELIMITER = '.';

// Custom Types:
// Tree: see parser.js

// greaterThanOne :: [a] -> Boolean
const greaterThanOne = R.compose(R.gt(R.__, 1), R.length);

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

// errorOrResult :: String, String, Function -> Tree OR String
const errorOrResult = R.curry((query, path, onSuccessFn) =>
  R.ifElse(errorProp, errorProp, onSuccessFn)(walkTree(R.split(PATH_DELIMITER, path), parse(query)))
);

// argumentsAtPath :: String, String -> Tree OR String
exports.argumentsAtPath = (query, path) => errorOrResult(query, path, R.compose(R.propOr([], 'arguments'), treeProp));

// treeAtPath :: String, String -> Tree OR String
exports.treeAtPath = (query, path) => errorOrResult(query, path, treeProp);
