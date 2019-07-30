const dict = {
  FIELD: 'field',
  FIELD_COMPLEX: 'field (complex)',
  FIELD_SCALAR: 'field (scalar)',

  GROUP_START: 'group start',
  GROUP_END: 'group end',
};

exports.lex = function(tokens, debug = false) {
  const lexed = tokens.map((token, index) => (
    {
      value: token,
      definition: defineToken(token),
      index,
    }
  ));

  // assign depth to groups + items
  let depth = 0;
  for (let i = 0; i < lexed.length; i++) {
    const item = lexed[i];
    if (item.definition === dict.GROUP_START) {
      item.depth = depth;
      depth++;
    } else if (item.definition === dict.GROUP_END) {
      depth--;
      item.depth = depth;
    } else {
      item.depth = depth;
    }
  }

  // refine fields into complex/scalar
  for (let i = 0; i < lexed.length; i++) {
    if (lexed[i].definition === dict.FIELD) {
      if (lexed[i + 1].definition === dict.GROUP_START) {
        lexed[i].definition = dict.FIELD_COMPLEX;
      } else {
        lexed[i].definition = dict.FIELD_SCALAR;
      }
    }
  }

  if (debug) {
    let tokenMaxLength = -1;
    let definitionMaxLength = -1;
    for (let i = 0; i < lexed.length; i++) {
      const token = lexed[i];
      const padding = ' '.repeat(token.depth * 4);
      tokenMaxLength = Math.max(tokenMaxLength, (padding.length + token.value.length));
      definitionMaxLength = Math.max(definitionMaxLength, token.definition.length);
    }

    console.log(`Results of lexing (tokens: ["${tokens.join('", "')}"]):`);
    for (let i = 0; i < lexed.length; i++) {
      const token = lexed[i];
      const padding = ' '.repeat(token.depth * 4);
      const leftPaddedTokenString = `${padding}${token.value}`;

      const fullyPaddedTokenString = leftPaddedTokenString.padEnd(tokenMaxLength, ' ');
      const rightPaddedDef = `Def: '${token.definition}'`.padEnd(definitionMaxLength + 7, ' ');
      console.log(`${fullyPaddedTokenString} - ${rightPaddedDef} - Depth: ${token.depth}`);
    }
  }

  return lexed;
};

const defineToken = function(token) {
  switch (token) {
    case '{':
      return dict.GROUP_START;
    case '}':
      return dict.GROUP_END;
    default:
      break;
  }

  if (/\w/.test(token)) {
    return dict.FIELD;
  }

  console.error('Unknown token type:', token);
  return null;
};

exports.dictionary = dict;
