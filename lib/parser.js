const tokenize = require('./tokenizer').tokenize;
const lex = require('./lexer').lex;
const dict = require('./lexer').dictionary;

exports.parse = function(str, debug = false) {
  const tokens = tokenize(str, debug);
  const lexed = lex(tokens, debug);
  return recursiveParse(lexed, debug);
};

const makeScalarNode = function(item) {
  return {
    'value': item.value,
    'type': dict.FIELD_SCALAR,
  };
};

const makeRoot = function() {
  return makeComplexNode({ value: 'root' });
};

const makeComplexNode = function(item, children = []) {
  return {
    'value': item.value,
    'type': dict.FIELD_COMPLEX,
    'children': children,
  };
};

const isScalar = function(item) {
  return item.definition === dict.FIELD_SCALAR;
};

const isComplex = function(item) {
  return item.definition === dict.FIELD_COMPLEX;
};

const isGroupEnd = function(item) {
  return item.definition === dict.GROUP_END;
};

const compareByValue = function(a, b) {
  if (a.value < b.value) {
    return -1;
  } else if (a.value > b.value) {
    return 1;
  }
  return 0;
};

const recursiveParse = function(lexed, debug = false, depth = 0, ast = makeRoot()) {
  // depth n's children are items at depth n + 1
  const nextDepth = depth + 1;
  const deeperItems = lexed.filter((item) => item.depth >= nextDepth);

  // Scalar children are leaf items for this depth
  lexed
    .filter((item) => isScalar(item))
    .filter((item) => item.depth === nextDepth)
    .forEach((item) => ast.children.push(makeScalarNode(item)));

  // Find complex children groups, and add their recursively parsed definitions to our children list
  let childStartIndex = -1;
  for (let index = 0; index < deeperItems.length; index++) {
    const item = deeperItems[index];

    // GROUP_START tokens define a child's group children, but name of child is FIELD_COMPLEX token before GROUP_START
    if (isComplex(item) && item.depth === nextDepth) {
      childStartIndex = index;
    } else if (childStartIndex > -1 && isGroupEnd(item) && item.depth === nextDepth) {
      const childAndItsChildren = deeperItems.slice(childStartIndex, index + 1);
      const node = makeComplexNode(childAndItsChildren[0]);
      const complexChildNode = recursiveParse(childAndItsChildren, debug, nextDepth, node);
      ast.children.push(complexChildNode);
      childStartIndex = -1;
    }
  }

  // Sorting children, so that functionally equivalent graphql queries
  // (with different orders for their requested fields) can deterministically produce the same AST
  ast.children.sort(compareByValue);

  //TODO add debugging

  return ast;
};
