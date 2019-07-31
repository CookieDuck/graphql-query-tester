const tokenize = require('./tokenizer').parse;
const lex = require('./lexer').lex;
const dict = require('./lexer').dictionary;

exports.createAst = function(str, debug = false) {
  const tokens = tokenize(str, debug);
  const lexed = lex(tokens, debug || true);
  return createAstFromLexed(lexed, debug);
};

const createAstFromLexed = function(lexed, debug = false) {
  return recursiveParse(lexed, debug);
};

exports.createAstFromLexed = createAstFromLexed;

const makeScalarNode = function(value) {
  return {
    'value': value,
    'type': dict.FIELD_SCALAR,
  };
};

const makeComplexNode = function(value, children = []) {
  return {
    'value': value,
    'type': dict.FIELD_COMPLEX,
    'children': children,
  };
};

const recursiveParse = function(lexed, debug = false, depth = 0, ast = makeComplexNode('root')) {
  // depth n: children are n + 1 items
  // field complex items are children, and THEIR children are n + 2 items within THEIR group
  // field scalar items are children who are leaves
  // group start tokens define children.  name of child is field complex token BEFORE group start
  const deeperItems = lexed.filter((item) => item.depth >= depth + 1);

  // terminal leaf items
  const myLeafChildren = lexed
    .filter((item) => item.definition === dict.FIELD_SCALAR)
    .filter((item) => item.depth === depth + 1);
  myLeafChildren.forEach((item) => ast.children.push(makeScalarNode(item.value)));

  // List of lists.
  // Each list inside the outer list is a list of items that define a child and that child's children
  // Each item in the outer list is therefore a child for "our" node.
  const myComplexChildrenAndTheirChildren = [];
  let childStartIndex = -1;
  for (let i = 0; i < deeperItems.length; i++) {
    const item = deeperItems[i];

    if (item.definition === dict.FIELD_COMPLEX && item.depth === depth + 1) {
      childStartIndex = i;
    } else if (childStartIndex > -1 && item.definition === dict.GROUP_END && item.depth === depth + 1) {
      const childAndChildren = [];
      for (let j = childStartIndex; j <= i; j++) {
        childAndChildren.push(deeperItems[j]);
      }
      myComplexChildrenAndTheirChildren.push(childAndChildren);
      childStartIndex = -1;
    }
  }

  for (let i = 0; i < myComplexChildrenAndTheirChildren.length; i++) {
    const childAndChildren = myComplexChildrenAndTheirChildren[i];
    const complexChildNode = makeComplexNode(childAndChildren[0].value);
    recursiveParse(childAndChildren, debug, depth + 1, complexChildNode);
    ast.children.push(complexChildNode);
  }

  //TODO sort children alphabetically before returning?

  //TODO add debugging

  return ast;
};
