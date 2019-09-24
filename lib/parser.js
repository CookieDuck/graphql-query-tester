const tokenize = require('./tokenizer').tokenize;
const lex = require('./lexer').lex;
const dict = require('./lexer').dictionary;
const verifyReferencesAndDeclarations = require('./lexer').verifyReferencesAndDeclarations;
const printTableForItems = require('./util').printTableForItems;

exports.parse = function(str, debug = false) {
  const tokens = tokenize(str, debug);

  let lexed;
  try {
    lexed = lex(tokens, debug);
  } catch (ex) {
    return { error: ex.message };
  }

  const queryAndFragmentDeclarations = findQueryAndFragmentDeclarations(lexed, debug);
  const root = recursiveParse(queryAndFragmentDeclarations.query, debug);
  root.fragments = parseFragmentDeclarations(queryAndFragmentDeclarations.fragments, debug);

  try {
    verifyFragmentDeclarations(root, debug);
  } catch (ex) {
    return { error: ex.message };
  }
  return root;
};

function findQueryAndFragmentDeclarations(lexed, debug) {
  const rootItems = lexed.filter((item) => item.depth === 0);

  if (debug) {
    console.log("\n--- Parsing ---\n");
    console.log("Considering the following root items for query and fragment definitions", rootItems);
  }
  if (rootItems.length < 2) {
    //TODO throw a parsing error?
  }
  let query;
  if (isGroupStart(rootItems[0]) && isGroupEnd(rootItems[1])) {
    query = lexed.slice(rootItems[0].index, rootItems[1].index + 1);

    if (debug) {
      console.log("Query items:", query);
    }
  } else {
    // TODO throw a parsing error?
  }

  const fragments = [];
  if (rootItems.length > 2) {
    if (debug) {
      console.log("Checking for fragment definitions...");
    }

    const minRequiredTokensForFragmentDeclaration = 6;
    for (let i = 2; i < rootItems.length; i += minRequiredTokensForFragmentDeclaration) {
      const hasMinRequiredTokens = i + minRequiredTokensForFragmentDeclaration <= rootItems.length;
      const hasFragmentKeyword = rootItems[i].definition === dict.FRAGMENT_KEYWORD;
      const hasDeclaration = rootItems[i + 1].definition === dict.FRAGMENT_DECLARATION;
      const hasOnKeyword = rootItems[i + 2].definition === dict.ON_KEYWORD;
      const hasTypeName = rootItems[i + 3].definition === dict.FRAGMENT_TYPE_NAME;
      const hasGroupStart = isGroupStart(rootItems[i + 4]);
      const hasGroupEnd = isGroupEnd(rootItems[i + 5]);
      const hasContentInGroup = rootItems[i + 4].index !== rootItems[i + 5].index - 1;

      if (
        hasMinRequiredTokens &&
        hasFragmentKeyword &&
        hasDeclaration &&
        hasOnKeyword &&
        hasTypeName &&
        hasGroupStart &&
        hasGroupEnd &&
        hasContentInGroup
      ) {
        const fragment = lexed.slice(rootItems[i].index, rootItems[i + 5].index  + 1);
        if (debug) {
          console.log("Found fragment definition: ", fragment);
        }
        fragments.push(fragment);
      } else {
        if (debug) {
          console.log("Likely have a fragment with no declaration...")
        }
      }
    }
  }

  const result = {
    query,
    fragments,
  };

  if (debug) {
    console.log("Results of parsing query and fragment definitions:");
    console.log(" Query:", query);
    if (fragments.length) {
      for (let i = 0; i < fragments.length; i++) {
        const obj = fragments[i];
        if (obj.length) {
          for (let j = 0; j < obj.length; j++) {
            console.log(`  Fragment at Outer index: ${i}, inner index: ${j} is: ${JSON.stringify(obj[j])}`);
          }
        }
      }
    }
  }

  return result;
}

function parseFragmentDeclarations(fragmentDeclarations, debug) {
  return fragmentDeclarations.map((fragmentDefinition) => {
    const type = dict.FRAGMENT_DECLARATION;
    const typeReference = fragmentDefinition[3].value;
    const value = fragmentDefinition[1].value;
    const childrenToParse = fragmentDefinition.slice(4);
    const children = [];
    recursiveParse(childrenToParse, debug, 0, { children });

    return {
      type,
      typeReference,
      value,
      children,
    };
  });
}

function verifyFragmentDeclarations(node, debug) {
  const references = findFragmentReferences(node);
  const declarations = node.fragments ? node.fragments.map((fragment) => fragment.value) : [];
  if (debug) {
    console.log("Parser found the following fragment references:", references);
    console.log("Parser found the following fragment declarations:", declarations);
  }

  verifyReferencesAndDeclarations(references, declarations);
}

function findFragmentReferences(node) {
  const references = new Set();
  if (node.type === dict.FRAGMENT_NAME) {
    references.add(node.value);
  }
  if (node.children) {
    node.children.forEach((child) => {
      const childSet = findFragmentReferences(child);
      childSet.forEach((item) => references.add(item));
    });
  }
  return references;
}

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
    value: item.value,
    type: dict.FIELD_SCALAR,
    arguments: parseArguments(item, lexed),
  };
};

const makeRoot = function() {
  const root = makeComplexNode({ value: 'root' });
  root['fragments'] = [];
  return root;
};

const makeComplexNode = function(item, lexed = []) {
  return {
    value: item.value,
    type: dict.FIELD_COMPLEX,
    children: [],
    arguments: parseArguments(item, lexed),
  };
};

const makeInlineFragmentNode = function(value) {
  return {
    value,
    type: dict.INLINE_FRAGMENT,
    children: [],
  };
};

const isScalar = function(item) {
  return item.definition === dict.FIELD_SCALAR;
};

const isComplex = function(item) {
  return item.definition === dict.FIELD_COMPLEX;
};

const isGroupStart = function(item) {
  return item.definition === dict.GROUP_START;
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
  let inlineFragmentStartIndex = -1;
  const deeperItems = lexed.filter((item) => item.depth > depth);
  for (let index = 0; index < deeperItems.length; index++) {
    const item = deeperItems[index];
    if (item.depth !== nextDepth) {
      continue;
    }

    // GROUP_START tokens define a child's group children, but name of child is FIELD_COMPLEX token before GROUP_START
    if (isComplex(item)) {
      childStartIndex = index;
    } else if (childStartIndex > -1 && isGroupEnd(item)) {
      // GROUP_END corresponding to GROUP_START
      const childAndItsChildren = deeperItems.slice(childStartIndex, index + 1);
      const node = makeComplexNode(childAndItsChildren[0], childAndItsChildren);
      const complexChildNode = recursiveParse(childAndItsChildren, debug, nextDepth, node);
      ast.children.push(complexChildNode);
      childStartIndex = -1;
    } else if (item.definition === dict.FRAGMENT_NAME && deeperItems[index - 1].definition === dict.ELLIPSIS) {
      // FRAGMENT - possibly included to GROUP, but not necessarily
      const fragment = {
        type: dict.FRAGMENT_NAME,
        value: item.value,
      };
      ast.children.push(fragment);
    } else if (
      item.definition === dict.FRAGMENT_TYPE_NAME &&
      deeperItems[index - 1].definition === dict.ON_KEYWORD &&
      deeperItems[index - 2].definition === dict.ELLIPSIS
    ) {
      // Inline fragment beginning
      inlineFragmentStartIndex = index;
    } else if (inlineFragmentStartIndex > -1 && isGroupEnd(item)) {
      // Inline fragment end
      const inlineFragmentTypeName = deeperItems[inlineFragmentStartIndex].value;
      const node = makeInlineFragmentNode(inlineFragmentTypeName);
      const fragmentAndItsChildren = deeperItems.slice(inlineFragmentStartIndex, index + 1);
      const inlineFragmentNode = recursiveParse(fragmentAndItsChildren, debug, nextDepth, node);
      ast.children.push(inlineFragmentNode);
      inlineFragmentStartIndex = -1;
    }
  }

  // Sorting children, so that functionally equivalent graphql queries
  // (with different orders for their requested fields) can deterministically produce the same AST
  ast.children.sort(compareByValue);

  return ast;
};
