const {
  argumentsAtPath,
  queryHasStructure,
  findErrors,
  treeAtPath,
}  = require('./lib/analyzer');
const {
  format,
} = require('./lib/formatter');
const {
  // explicit
  argument,
  leaf,
  branchWithArguments,
  branch,
  fragmentDeclaration,
  fragment,
  inlineFragment,
  query,

  // terse
  a,
  l,
  ba,
  b,
  fd,
  f,
  i,
  q,
} = require('./lib/structure');

module.exports = {
  // analyzer
  argumentsAtPath,
  treeAtPath,
  queryHasStructure,
  findErrors,

  // formatter
  format,

  // structure
  argument,
  leaf,
  branchWithArguments,
  branch,
  fragmentDeclaration,
  fragment,
  inlineFragment,
  query,
  a,
  l,
  ba,
  b,
  fd,
  f,
  i,
  q,
};
