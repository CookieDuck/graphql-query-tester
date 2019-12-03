const dict = require('../lib/lexer').dictionary;

const arg = function(name, value, type) {
  return {
    name,
    value,
    type,
  };
};

const scalarWithArgs = function(value, ...arguments) {
  return {
    type: dict.FIELD_SCALAR,
    value,
    arguments,
  };
};

const scalar = function(value) {
  return scalarWithArgs(value)
};

const complexWithArgs = function(value, arguments = [], ...children) {
  return {
    type: dict.FIELD_COMPLEX,
    value,
    arguments,
    children,
  };
};

const complex = function(value, ...children) {
  return complexWithArgs(value, [], ...children);
};

const fragment = function(value) {
  return {
    type: dict.FRAGMENT_NAME,
    value,
  };
};

const inlineFragment = function(value, ...children) {
  return {
    type: dict.INLINE_FRAGMENT,
    value,
    children,
  };
};

const fragmentDeclaration = function(value, typeReference, ...children) {
  return {
    type: dict.FRAGMENT_DECLARATION,
    value,
    typeReference,
    children
  };
};

const root = function(...children) {
  const root = complex('root', ...children);
  root['fragments'] = [];
  return root;
};

const rootWithFragments = function(fragmentArray, ...children) {
  const rootNode = root(...children);
  rootNode['fragments'] = fragmentArray;
  return rootNode;
};

module.exports = {
  arg,
  scalarWithArgs,
  scalar,
  complexWithArgs,
  complex,
  fragment,
  inlineFragment,
  fragmentDeclaration,
  root,
  rootWithFragments,
};
