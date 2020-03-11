const R = require('ramda');

const parse = require('./parser').parse;

const PATH_DELIMITER = '.';

const greaterThanOne = R.compose(R.gt(R.__, 1), R.length);

const recursiveParse = R.curry((traversedPath, nodeNames, tree) => {
  const firstNodeName = R.head(nodeNames);
  const subtree = getSubtreeAtNodeName(traversedPath, firstNodeName, tree);

  const pathRemainingAndHasNoError = R.compose(R.and(greaterThanOne(nodeNames)), R.isNil, R.prop('error'));

  const partiallyAppliedRecursiveParse = recursiveParse(
    R.concat(traversedPath, [ firstNodeName ]),
    R.drop(1, nodeNames),
  );
  const parseSubTree = R.compose(partiallyAppliedRecursiveParse, R.prop('tree'),);

  return R.ifElse(pathRemainingAndHasNoError, parseSubTree, R.identity)(subtree);
});

const walkTree = recursiveParse([]);

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

exports.argumentsAtPath = function(query, path) {
  return R.ifElse(
    R.prop('error'),
    R.prop('error'),
    R.compose(R.propOr([], 'arguments'), R.prop('tree')),
  )(walkTree(R.split(PATH_DELIMITER, path), parse(query)));
};
