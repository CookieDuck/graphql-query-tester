const tokenize = require('./tokenizer').parse;
const lex = require('./lexer').lex;
const dict = require('./lexer').dictionary;

exports.createAst = function(str, debug = false) {
  const tokens = tokenize(str, debug);
  const lexed = lex(tokens, debug);
  return createAstFromLexed(lexed, debug);
};

const createAstFromLexed = function(lexed, debug = false) {
  const ast = recursiveParse(lexed, debug || true);;
  return ast;
};

exports.createAstFromLexed = createAstFromLexed;

const recursiveParse = (lexed, debug = false, depth = 0, ast = {}) => {
  if (debug) {
    console.log('depth', depth, 'received lexed:', lexed);
  }

  const itemsForDepth = lexed.filter((item) => item.depth === depth);
  if (itemsForDepth.length === 0) {
    if (debug) {
      console.log('depth:', depth, 'is empty; return');
    }
    return ast;
  }

  const deeperItems = lexed.filter((item) => item.depth > depth);
  if (deeperItems.length === 0) {
    if (debug) {
      console.log('depth:', depth, 'has no deeper items; return');
    }
    return ast;
  }

  let target = ast;
  if (depth === 0) {
    const root = {};
    ast['root'] = root;
    target = root;
  }

  const scalarsInNextGroup = deeperItems.filter((item) => item.definition === dict.FIELD_SCALAR && item.depth === depth + 1);
  if (debug) {
    console.log('depth', depth, 'scalars in NEXT group', scalarsInNextGroup);
  }
  for (let i in scalarsInNextGroup) {
    target[scalarsInNextGroup[i].value] = scalarsInNextGroup[i].definition;
  }

  const complexInMyGroup = itemsForDepth.filter((item) => item.definition === dict.FIELD_COMPLEX);
  if (debug) {
    console.log('depth', depth, 'complex in my group', complexInMyGroup);
  }

  // 'recurse and assign' over complex scalars at depth + 1
  const complexFieldsInNextGroup = deeperItems.filter((item) => item.definition === dict.FIELD_COMPLEX && item.depth === depth + 1);
  if (debug) {
    console.log('(depth + 1)', depth + 1, 'complex scalars', complexFieldsInNextGroup);
  }
  for (let i in complexFieldsInNextGroup) {
    const result = recursiveParse(deeperItems, debug, depth + 1, {});
    target[complexFieldsInNextGroup[i].value] = result;
  }

  return ast;
};