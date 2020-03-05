const parse = require('./parser').parse;
const dict = require('./lexer').dictionary;
const R = require('ramda');

function parseArgument(accumulator, argument) {
  accumulator.push(argument.name);
  accumulator.push(': ');
  if (argument.type === 'quoted') {
    accumulator.push('"');
  }
  accumulator.push(argument.value);
  if (argument.type === 'quoted') {
    accumulator.push('"');
  }
}

function parseArguments(accumulator, arguments) {
  if (R.isEmpty(arguments)) {
    return;
  }
  
  accumulator.push('(');
  const allButLast = R.dropLast(1, arguments);
  allButLast.forEach(arg => {
    parseArgument(accumulator, arg);
    accumulator.push(', ');
  });
  parseArgument(accumulator, R.last(arguments));
  accumulator.push(')');
}

function parseChildren(accumulator, children) {
  if (R.isEmpty(children)) {
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

const parseDeclaration = R.curry((accumulator, declaration) => {
  accumulator.push(' fragment ');
  accumulator.push(declaration.name);
  accumulator.push(' on ');
  accumulator.push(declaration.typeReference);

  if (declaration.children) {
    accumulator.push(' { ');
    parseChildren(accumulator, declaration.children);
    accumulator.push(' }');
  }
});

function parseFragmentDeclarations(accumulator, declarations) {
  const parse = parseDeclaration(accumulator);
  R.ifElse(
    R.isEmpty,
    R.always([]),
    (f) => f.forEach(parse),
  )(declarations);
}

exports.format = function(str) {
  const ast = parse(str);
  const result = [];

  result.push('{ ');
  parseChildren(result, ast.children);
  result.push(' }');

  parseFragmentDeclarations(result, ast.fragmentDeclarations);

  return result.join('');
};
