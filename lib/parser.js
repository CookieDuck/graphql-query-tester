const tokenize = require('./tokenizer').tokenize;
const lex = require('./lexer').lex;
const dict = require('./lexer').dictionary;
const printTableForItems = require('./util').printTableForItems;

exports.parse = function(str, debug = false) {
  const tokens = tokenize(str, debug);

  let lexed;
  try {
    lexed = lex(tokens, debug);
  } catch (ex) {
    return { error: ex.message };
  }

  return recursiveParse(lexed, debug);
};

function isFloat(val) {
  const floatRegex = /^-?\d+(?:[.,]\d*?)?$/;
  if (!floatRegex.test(val))
    return false;

  const floatVal = parseFloat(val);
  return !isNaN(floatVal);
}

function isInt(val) {
  const intRegex = /^-?\d+$/;
  if (!intRegex.test(val))
    return false;

  const intVal = parseInt(val, 10);
  return parseFloat(val) === intVal && !isNaN(intVal);
}

const determineType = function(item, lexed) {
  const value = item.value;
  if (isInt(value)) {
    return 'int';
  }

  if (isFloat(value)) {
    return 'float';
  }

  const findDefinitionByIndex = function(lexed, index) {
    const token = lexed.find((item) => item.index === index);
    return token && token.definition ? token.definition : null;
  };
  const index = item.index;
  const previous = findDefinitionByIndex(lexed, index - 1);
  const next = findDefinitionByIndex(lexed, index + 1)
  if (previous === dict.QUOTES && next === dict.QUOTES) {
    return 'string';
  }

  if (typeof value !== 'number') {
    return 'enum';
  }

  console.debug(`Cannot determine type of '${value}'`);
  return null;
};

const parseArguments = function(token, lexed) {
  const arguments = [];

  // narrow down the search window for arguments
  let start = -1;
  let end = -1;
  for (let i = 0; i < lexed.length; i++) {
    if (lexed[i].depth !== token.depth) {
      continue;
    }
    if (lexed[i].definition === dict.ARGUMENT_START) {
      start = i;
    } else if (lexed[i].definition === dict.ARGUMENT_END) {
      end = i;
      break;
    }
  }
  if (start < 0 || end < 0) {
    return arguments;
  }

  // enumerate arguments
  let name, value, type;
  for (let i = start; i < end; i++) {
    const item = lexed[i];
    const def = item.definition;
    if (def === dict.ARGUMENT_NAME) {
      name = item.value;
    } else if (def === dict.ARGUMENT_VALUE) {
      value = item.value;
      type = determineType(item, lexed);
    }

    if (name && value && type) {
      arguments.push({ name, value, type });
      name = value = type = null;
    }
  }

  return arguments;
};

const makeScalarNode = function(item, lexed) {
  return {
    'value': item.value,
    'type': dict.FIELD_SCALAR,
    'arguments': parseArguments(item, lexed),
  };
};

const makeRoot = function() {
  return makeComplexNode({ value: 'root' });
};

const makeComplexNode = function(item, lexed = []) {
  return {
    'value': item.value,
    'type': dict.FIELD_COMPLEX,
    'children': [],
    'arguments': parseArguments(item, lexed),
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

const printDebug = function(depth, items) {
  const columns = ['index', 'value', 'definition', 'depth'];
  const generatePrintItem = function(item) {
    const target = {};
    target[columns[0]] = item.index.toString();
    target[columns[1]] = item.value.toString();
    target[columns[2]] = item.definition.toString();
    target[columns[3]] = item.depth.toString();
    return target;
  };

  const myItems = items.filter((item) => item.depth === depth).map((item) => generatePrintItem(item));
  const deeperItems = items.filter((item) => item.depth > depth).map((item) => generatePrintItem(item));

  const depthPadding = depth + 1;
  const indentString = ' '.repeat(depthPadding);

  console.log('');
  console.log(`${indentString}In recursiveParse for depth ${depth}`);
  console.log(`${indentString}My items:`);
  printTableForItems(columns, myItems, 4 * depthPadding);
  console.log(`${indentString}Deeper Items:`);
  printTableForItems(columns, deeperItems, 4 * depthPadding);
};

const recursiveParse = function(lexed, debug = false, depth = 0, ast = makeRoot()) {
  if (debug) {
    printDebug(depth, lexed);
  }

  // Scalar children are leaf items for this depth
  // depth n's children are items at depth n + 1
  const nextDepth = depth + 1;
  lexed
    .filter((item) => isScalar(item))
    .filter((item) => item.depth === nextDepth)
    .forEach((item) => ast.children.push(makeScalarNode(item, lexed)));

  // Find complex children groups, and add their recursively parsed definitions to our children list
  let childStartIndex = -1;
  const deeperItems = lexed.filter((item) => item.depth > depth);
  for (let index = 0; index < deeperItems.length; index++) {
    const item = deeperItems[index];

    // GROUP_START tokens define a child's group children, but name of child is FIELD_COMPLEX token before GROUP_START
    if (isComplex(item) && item.depth === nextDepth) {
      childStartIndex = index;
    } else if (childStartIndex > -1 && isGroupEnd(item) && item.depth === nextDepth) {
      const childAndItsChildren = deeperItems.slice(childStartIndex, index + 1);
      const node = makeComplexNode(childAndItsChildren[0], lexed);
      const complexChildNode = recursiveParse(childAndItsChildren, debug, nextDepth, node);
      ast.children.push(complexChildNode);
      childStartIndex = -1;
    }
  }

  // Sorting children, so that functionally equivalent graphql queries
  // (with different orders for their requested fields) can deterministically produce the same AST
  ast.children.sort(compareByValue);

  return ast;
};
