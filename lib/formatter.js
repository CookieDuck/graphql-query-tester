const parse = require('./parser').parse;
const dict = require('./lexer').dictionary;

function parseArguments(accumulator, arguments) {
  if (!arguments || arguments.length === 0) {
    return;
  }

  accumulator.push('(');
  for (let i = 0; i < arguments.length; i++) {
    const argument = arguments[i];

    accumulator.push(argument.name);
    accumulator.push(': ');
    if (argument.type === 'quoted') {
      accumulator.push('"');
    }
    accumulator.push(argument.value);
    if (argument.type === 'quoted') {
      accumulator.push('"');
    }
    if (i !== arguments.length - 1) {
      accumulator.push(', ');
    }
  }
  accumulator.push(')');
}

function parseChildren(accumulator, children) {
  if (!children || children.length === 0) {
    return;
  }

  for (let i = 0; i < children.length; i++) {
    const prevChild = children[i - 1];
    if (prevChild) {
      accumulator.push(' ');
    }

    const child = children[i];
    if (child.type === dict.FIELD_LEAF) {
      accumulator.push(child.name);
      if (child.arguments) {
        parseArguments(accumulator, child.arguments);
      }
    } else if (child.type === dict.FIELD_BRANCH) {
      accumulator.push(child.name);
      if (child.arguments) {
        parseArguments(accumulator, child.arguments);
      }

      accumulator.push(' { ');
      parseChildren(accumulator, child.children);
      accumulator.push(' }');
    } else if (child.type === dict.INLINE_FRAGMENT) {
      accumulator.push('... on ');
      accumulator.push(child.name);
      accumulator.push(' { ');
      parseChildren(accumulator, child.children);
      accumulator.push(' }');
    } else if (child.type === dict.FRAGMENT_NAME) {
      accumulator.push('...');
      accumulator.push(child.name);
    }
  }
}

function parseFragmentDeclarations(accumulator, declarations) {
  if (!declarations || declarations.length === 0) {
    return;
  }

  for (let i = 0; i < declarations.length; i++) {
    const declaration = declarations[i];
    accumulator.push(' fragment ');
    accumulator.push(declaration.name);
    accumulator.push(' on ');
    accumulator.push(declaration.typeReference);

    if (declaration.children) {
      accumulator.push(' { ');
      parseChildren(accumulator, declaration.children);
      accumulator.push(' }');
    }
  }
}

exports.format = function(str, debug = false) {
  const ast = parse(str);
  const result = [];

  result.push('{ ');
  parseChildren(result, ast.children);
  result.push(' }');

  parseFragmentDeclarations(result, ast.fragmentDeclarations);

  return result.join('');
};
