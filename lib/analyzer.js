const R = require('ramda');

const parse = require('./parser').parse;

// greaterThanOne :: Array -> boolean
// Returns true when length of supplied array is > 1, false in all other cases
const greaterThanOne = R.compose(R.gt(R.__, 1), R.length);

// crawlTree :: (Tree, Array) -> Tree
// Crawls over given tree, walking the "path" specified by nodeNames
const crawlTree = R.curry((tree, nodeNames) => {
  /// function that computes the subtree given current tree and head of list.  Takes nodeNames as an argument.
  const getTreeRootedAtNode = R.compose(treeAt(tree), R.head);

  // function that makes a recursive call to crawlTree, with the subtree rooted at head of list,
  // and all remaining elements (after head) in list.  Takes nodeNames as an argument.
  const walkInOneLevel = R.compose(crawlTree(getTreeRootedAtNode(nodeNames)), R.drop(1));

  return R.ifElse(greaterThanOne, walkInOneLevel, getTreeRootedAtNode)(nodeNames);
});

// treeAt :: (Tree, String) -> Tree
// Given a tree and the name of one of its children, returns tree rooted at that child.  Returns undefined if no such
// child exists
const treeAt = R.curry((tree, nodeName) => {
  return R.find(
    R.compose(R.equals(nodeName), R.prop('name')),
    R.propOr([], 'children', tree),
  );
});

exports.argumentsAtPath = function(query, path) {
  return R.propOr([], 'arguments', crawlTree(parse(query), R.split('.', path)));
};
