const printTableForItems = require('./util').printTableForItems;

const dict = {
  WORD: 'word',

  FIELD_COMPLEX: 'field (complex)',
  FIELD_SCALAR: 'field (scalar)',

  GROUP_START: 'group start',
  GROUP_END: 'group end',

  // Argument definitions
  ARGUMENT_START: 'argument start',
  ARGUMENT_END: 'argument end',
  ARGUMENT_NAME: 'argument name',
  ARGUMENT_VALUE: 'argument value',
  COLON: 'argument name/value separator',
  QUOTES: 'argument value start/end character for string',
  COMMA: 'argument separator',

  // Fragment definitions
  ELLIPSIS: 'fragment ellipsis',
  FRAGMENT_KEYWORD: "keyword 'fragment'",
  ON_KEYWORD: "keyword 'on'",
  FRAGMENT_NAME: 'name for fragment (must reference a declaration)',
  FRAGMENT_DECLARATION: 'declaration of a fragment',
  FRAGMENT_TYPE_NAME: 'name of type referenced by fragment',

  // Just for AST nodes in parser
  INLINE_FRAGMENT: "inline fragment declaration",
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

  checkFragments(lexed);

  if (debug) {
    printDebug(tokens, lexed);
  }

  return lexed;
};

const defineToken = function(token) {
  switch (token) {
    case '{':
      return dict.GROUP_START;
    case '}':
      return dict.GROUP_END;

    // Arguments
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

    // Fragments
    case '...':
      return dict.ELLIPSIS;
    case 'on':
      return dict.ON_KEYWORD;
    case 'fragment':
      return dict.FRAGMENT_KEYWORD;

    default:
      break;
  }

  if (/\w/.test(token)) {
    return dict.WORD;
  }

  console.error('Unknown token type:', token);
  return null;
};

const checkFragments = function(lexed) {
  const references = lexed
    .filter((item) => item.definition === dict.FRAGMENT_NAME)
    .map((item) => item.value);

  const declarations = lexed
    .filter((item) => item.definition === dict.FRAGMENT_DECLARATION)
    .map((item) => item.value);

  verifyReferencesAndDeclarations(references, declarations);
};

const verifyReferencesAndDeclarations = function(references, declarations) {
  references.forEach((name) => {
    if (!declarations.includes(name)) {
      const definitions = `[${declarations.join(", ")}]`;
      let error = `Syntax error: Fragment '${name}' has no definition.  `;
      error += `Available fragment definitions: ${definitions}`;
      throw Error(error);
    }
  });

  const refs = Array.from(references); // clients either pass a set or an array, so coerce to array always
  declarations.forEach((name) => {
    if (!refs.includes(name)) {
      throw Error(`Syntax error: Fragment '${name}' is declared, but never used`);
    }
  });
};

const refineWords = function(lexed) {
  // determine argument name/values.  Can also check for fragment definitions
  for (let i = 0; i < lexed.length; i++) {
    const item = lexed[i];
    if (item.definition !== dict.WORD) {
      continue;
    }

    const next = lexed[i + 1];
    const nDef = next.definition;
    if (nDef === dict.COLON) {
      item.definition = dict.ARGUMENT_NAME;
      continue;
    }

    const previous = lexed[i - 1];
    const pDef = previous.definition;
    if (pDef === dict.QUOTES && nDef === dict.QUOTES) {
      item.definition = dict.ARGUMENT_VALUE;
      continue;
    }

    if (pDef === dict.COLON && nDef === dict.ARGUMENT_END) {
      item.definition = dict.ARGUMENT_VALUE;
    }

    if (pDef === dict.COLON && nDef === dict.COMMA) {
      item.definition = dict.ARGUMENT_VALUE;
    }

    if (pDef === dict.ELLIPSIS) {
      item.definition = dict.FRAGMENT_NAME;
    }

    if (pDef === dict.FRAGMENT_KEYWORD) {
      item.definition = dict.FRAGMENT_DECLARATION;
    }

    if (pDef === dict.ON_KEYWORD) {
      item.definition = dict.FRAGMENT_TYPE_NAME;
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

const printDebug = function(tokens, lexed) {
  const tabLevel = 4;
  let tokenMaxLength = -1;
  for (let i = 0; i < lexed.length; i++) {
    const token = lexed[i];
    const padding = ' '.repeat(token.depth * tabLevel);
    tokenMaxLength = Math.max(tokenMaxLength, (padding.length + token.value.length));
  }

  const columns = ['token', 'definition', 'depth'];
  const generatePrintItem = function(token) {
    const padding = ' '.repeat(token.depth * tabLevel);
    const leftPaddedTokenString = `${padding}${token.value}`;
    const fullyPaddedTokenString = leftPaddedTokenString.padEnd(tokenMaxLength, ' ');

    const target = {};
    target[columns[0]] = fullyPaddedTokenString;
    target[columns[1]] = token.definition.toString();
    target[columns[2]] = token.depth.toString();
    return target;
  };
  const items = lexed.map((token) => generatePrintItem(token));

  if (tokens) {
    console.log(`Results of lexing (tokens: ["${tokens.join('", "')}"]):\n`);
  }
  printTableForItems(columns, items);
};

exports.dictionary = dict;
exports.verifyReferencesAndDeclarations = verifyReferencesAndDeclarations;
