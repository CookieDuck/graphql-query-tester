const dict = {
  WORD: 'word',

  FIELD_COMPLEX: 'field (complex)',
  FIELD_SCALAR: 'field (scalar)',

  GROUP_START: 'group start',
  GROUP_END: 'group end',

  ARGUMENT_START: 'argument start',
  ARGUMENT_END: 'argument end',
  ARGUMENT_NAME: 'argument name',
  ARGUMENT_VALUE: 'argument value',
  COLON: 'argument name/value separator',
  QUOTES: 'argument value start/end character for string',
  COMMA: 'argument separator',
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
  let groupStarts = 0;
  let groupEnds = 0;
  for (let i = 0; i < lexed.length; i++) {
    const item = lexed[i];
    if (item.definition === dict.GROUP_START) {
      item.depth = depth;
      depth++;
      groupStarts++;
    } else if (item.definition === dict.GROUP_END) {
      depth--;
      item.depth = depth;
      groupEnds++;
    } else {
      item.depth = depth;
    }
  }
  if (depth !== 0) {
    if (depth > 0) {
      throw Error(`Syntax error: Found ${groupStarts} '{' but only ${groupEnds} '}'`);
    } else {
      throw Error(`Syntax error: Found ${groupEnds} '}' but only ${groupStarts} '{'`);
    }
  }

  refineWords(lexed);

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

    case '(':
      return dict.ARGUMENT_START;
    case ')':
      return dict.ARGUMENT_END;
    case ':':
      return dict.COLON;
    case '"':
      return dict.QUOTES;
    case ',':
      return dict.COMMA;

    default:
      break;
  }

  if (/\w/.test(token)) {
    return dict.WORD;
  }

  console.error('Unknown token type:', token);
  return null;
};

const refineWords = function(lexed) {
  // determine argument name/values
  for (let i = 0; i < lexed.length; i++) {
    const item = lexed[i];
    if (item.definition !== dict.WORD) {
      continue;
    }

    const next = lexed[i + 1];
    if (next.definition === dict.COLON) {
      item.definition = dict.ARGUMENT_NAME;
      continue;
    }

    const previous = lexed[i - 1];
    if (previous.definition === dict.QUOTES && next.definition === dict.QUOTES) {
      item.definition = dict.ARGUMENT_VALUE;
      continue;
    }

    if (previous.definition === dict.COLON && next.definition === dict.ARGUMENT_END) {
      item.definition = dict.ARGUMENT_VALUE;
    }
  }

  // now that argument definitions are assigned, assign field definitions
  for (let i = 0; i < lexed.length; i++) {
    const item = lexed[i];
    if (item.definition !== dict.WORD) {
      continue;
    }

    const next = lexed[i + 1];
    if (next.definition === dict.GROUP_START) {
      item.definition = dict.FIELD_COMPLEX;
      continue;
    }

    if (next.definition === dict.ARGUMENT_START) {
      // find the end of the argument.  Next character should determine if it is scalar or complex
      let fieldDefinition = dict.FIELD_SCALAR;
      for (let j = i + 1; j < lexed.length; j++) {
        if (lexed[j].definition === dict.ARGUMENT_END) {
          if (j + 1 === lexed.length) {
            console.error(`Argument start at ${i} (${item}) has no matching argument end!`);
          } else {
            if (lexed[j + 1].definition === dict.GROUP_START) {
              fieldDefinition = dict.FIELD_COMPLEX;
            }
          }
        }
      }
      item.definition = fieldDefinition;
      continue;
    }

    item.definition = dict.FIELD_SCALAR;
  }
};

exports.dictionary = dict;
