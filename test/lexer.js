const expect = require('chai').expect;
const tokenizer = require('../lib/tokenizer');
const lexer = require('../lib/lexer');

describe('Lexer for tokens', () => {
  const dict = lexer.dictionary;

  it('Assigns values to tokens', () => {
    const graphql = '{ files }';
    const result = lexer.lex(tokenizer.tokenize(graphql));
    const values = result.map((item) => item.value);
    expect(values).to.eql(['{', 'files', '}']);
  });

  it('Assigns definitions to tokens', () => {
    const graphql = '{ paths { files } }';
    const result = lexer.lex(tokenizer.tokenize(graphql));
    const definitions = result.map((item) => item.definition);
    expect(definitions).to.eql([
      dict.GROUP_START,
      dict.FIELD_BRANCH,
      dict.GROUP_START,
      dict.FIELD_LEAF,
      dict.GROUP_END,
      dict.GROUP_END,
    ]);
  });

  it('Assigns indices to tokens', () => {
    const graphql = '{ files }';
    const result = lexer.lex(tokenizer.tokenize(graphql));
    const indices = result.map((item) => item.index);
    expect(indices).to.eql([0, 1, 2]);
  });

  it('Assigns depth to tokens', () => {
    //  depth indicates 'nesting', which is why 'paths' and its open and close braces are on depth 1
    //  Depth levels are closely related to 'proper' indentation
    //  0 1 2
    const graphql = `
        {
          paths {
            files
          }
        }`;
    const result = lexer.lex(tokenizer.tokenize(graphql));
    const depths = result.map((item) => item.depth);
    expect(depths).to.eql([0, 1, 1, 2, 1, 0]);
  });

  describe('Arguments', () => {
    describe('Definitions per type', () => {
      it('String', () => {
        const graphql = '{ files(extension: "txt") }';
        const result = lexer.lex(tokenizer.tokenize(graphql));
        const definitions = result.map((item) => item.definition);
        expect(definitions.slice(2, -2)).to.eql([
          dict.ARGUMENT_START,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.QUOTES,
          dict.ARGUMENT_VALUE,
          dict.QUOTES,
        ]);
      });

      it('Int', () => {
        const graphql = '{ files(limit: 3) }';
        const result = lexer.lex(tokenizer.tokenize(graphql));
        const definitions = result.map((item) => item.definition);
        expect(definitions.slice(2, -2)).to.eql([
          dict.ARGUMENT_START,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.ARGUMENT_VALUE,
        ]);
      });

      it('Float', () => {
        const graphql = '{ files(coolnessThreshold: 2.4) }';
        const result = lexer.lex(tokenizer.tokenize(graphql));
        const definitions = result.map((item) => item.definition);
        expect(definitions.slice(2, -2)).to.eql([
          dict.ARGUMENT_START,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.ARGUMENT_VALUE,
        ]);
      });

      it('Enum', () => {
        const graphql = '{ files(encoding: UTF_8) }';
        const result = lexer.lex(tokenizer.tokenize(graphql));
        const definitions = result.map((item) => item.definition);
        expect(definitions.slice(2, -2)).to.eql([
          dict.ARGUMENT_START,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.ARGUMENT_VALUE,
        ]);
      });
    });

    it('Assigns definitions to argument tokens', () => {
      const graphql = '{ files(extension: "txt") }';
      const result = lexer.lex(tokenizer.tokenize(graphql));
      const definitions = result.map((item) => item.definition);
      expect(definitions).to.eql([
        dict.GROUP_START,
        dict.FIELD_LEAF,
        dict.ARGUMENT_START,
        dict.ARGUMENT_NAME,
        dict.COLON,
        dict.QUOTES,
        dict.ARGUMENT_VALUE,
        dict.QUOTES,
        dict.ARGUMENT_END,
        dict.GROUP_END,
      ]);
    });

    it('Assigns values to argument tokens', () => {
      const graphql = '{ files(extension: "txt", limit: 3) }';
      const result = lexer.lex(tokenizer.tokenize(graphql));
      const values = result.map((item) => item.value);
      expect(values).to.eql([
        '{',
        'files',
        '(',
        'extension',
        ':',
        '"',
        'txt',
        '"',
        ',',
        'limit',
        ':',
        '3',
        ')',
        '}',
      ]);
    });

    it('Handles multiple arguments on a field', () => {
      const graphql = '{ files(extension: "txt", limit: 3) }';
      const result = lexer.lex(tokenizer.tokenize(graphql));
      const definitions = result.map((item) => item.definition);
      expect(definitions).to.eql([
        dict.GROUP_START,
        dict.FIELD_LEAF,
        dict.ARGUMENT_START,
        dict.ARGUMENT_NAME,
        dict.COLON,
        dict.QUOTES,
        dict.ARGUMENT_VALUE,
        dict.QUOTES,
        dict.COMMA,
        dict.ARGUMENT_NAME,
        dict.COLON,
        dict.ARGUMENT_VALUE,
        dict.ARGUMENT_END,
        dict.GROUP_END,
      ]);
    });

    it('Handles all sorts of multiple arguments on a scalar field', () => {
      const graphql = '{ files(extension: "txt", limit: 3, fileEncoding: UTF_8) }';
      const result = lexer.lex(tokenizer.tokenize(graphql));
      const definitions = result.map((item) => item.definition);
      expect(definitions).to.eql([
        dict.GROUP_START,
        dict.FIELD_LEAF,
        dict.ARGUMENT_START,
        dict.ARGUMENT_NAME,
        dict.COLON,
        dict.QUOTES,
        dict.ARGUMENT_VALUE,
        dict.QUOTES,
        dict.COMMA,
        dict.ARGUMENT_NAME,
        dict.COLON,
        dict.ARGUMENT_VALUE,
        dict.COMMA,
        dict.ARGUMENT_NAME,
        dict.COLON,
        dict.ARGUMENT_VALUE,
        dict.ARGUMENT_END,
        dict.GROUP_END,
      ]);
    });

    it('Identifies leaves with arguments in a complex query', () => {
      const graphql = `
      {
        a(arg1: "hi", arg2: 12, arg3: YO) {
          b(arg1: "boo")
          c
          d(arg1: "good", arg2: "ok") {
            e
            f
          }
        }
      }`;
      const result = lexer.lex(tokenizer.tokenize(graphql));
      const definitions = result.map(item => item.definition);
      expect(definitions).to.eql([
        dict.GROUP_START,
          dict.FIELD_BRANCH,   //a start
          dict.ARGUMENT_START,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.QUOTES,
          dict.ARGUMENT_VALUE,
          dict.QUOTES,
          dict.COMMA,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.ARGUMENT_VALUE,
          dict.COMMA,
          dict.ARGUMENT_NAME,
          dict.COLON,
          dict.ARGUMENT_VALUE,
          dict.ARGUMENT_END,
          dict.GROUP_START,     // a end
            dict.FIELD_LEAF,    // b start
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,  // b end
            dict.FIELD_LEAF,    // c
            dict.FIELD_BRANCH,  // d start
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.COMMA,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,
            dict.GROUP_START,    // d end
              dict.FIELD_LEAF,   // e
              dict.FIELD_LEAF,   // f
            dict.GROUP_END,
          dict.GROUP_END,
        dict.GROUP_END,
      ]);
    });
  });

  describe('Fragments', () => {
    describe('Normal', () => {
      describe('simple fragment', () => {
        const graphql =
        `{
          files(name: "derp") {
            ...fileFields
          }
        }

        fragment fileFields on ProjectFiles {
          type
          name
        }`;

        it('handles definitions', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const definitions = result.map((item) => item.definition);
          expect(definitions).to.eql([
            dict.GROUP_START,
            dict.FIELD_BRANCH,
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,
            dict.GROUP_START,

            dict.ELLIPSIS,
            dict.FRAGMENT_NAME,

            dict.GROUP_END,
            dict.GROUP_END,

            dict.FRAGMENT_KEYWORD,
            dict.FRAGMENT_DECLARATION,
            dict.ON_KEYWORD,
            dict.FRAGMENT_TYPE_NAME,

            dict.GROUP_START,
            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.GROUP_END,
          ]);
        });

        it('handles values', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const values = result.map((item) => item.value);
          expect(values).to.eql([
            '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
            '...', 'fileFields', '}', '}',
            'fragment', 'fileFields', 'on', 'ProjectFiles', '{',
            'type',
            'name', '}',
          ]);
        });

        it('handles depths', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const depths = result.map((item) => item.depth);
          expect(depths).to.eql([
            0, //{
            1, //files
            1, //(
            1, //name
            1, //:
            1, //"
            1, //derp
            1, //"
            1, //)
            1, //{

            2, //...
            2, //fileFields

            1, //}
            0, //}

            0, //fragment
            0, //fileFields
            0, //on
            0, //ProjectFiles

            0, //{
            1, //type
            1, //name
            0, //}
          ]);
        });
      });

      describe('complex fragment', () => {
        const graphql = `
        {
          files(name: "derp") {
            ...fileFields
          }
        }

        fragment fileFields on ProjectFiles {
          type
          name
          extension
          authors {
            firstName
            lastName
          }
        }`;

        it('handles definitions', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const definitions = result.map((item) => item.definition);
          expect(definitions).to.eql([
            dict.GROUP_START,
            dict.FIELD_BRANCH,
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,
            dict.GROUP_START,

            dict.ELLIPSIS,
            dict.FRAGMENT_NAME,

            dict.GROUP_END,
            dict.GROUP_END,

            dict.FRAGMENT_KEYWORD,
            dict.FRAGMENT_DECLARATION,
            dict.ON_KEYWORD,
            dict.FRAGMENT_TYPE_NAME,

            dict.GROUP_START,
            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.FIELD_LEAF,

            dict.FIELD_BRANCH,
            dict.GROUP_START,
            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.GROUP_END,

            dict.GROUP_END,
          ]);
        });

        it('handles values', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const values = result.map((item) => item.value);
          expect(values).to.eql([
            '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
            '...', 'fileFields', '}', '}',
            'fragment', 'fileFields', 'on', 'ProjectFiles', '{',
            'type',
            'name',
            'extension',
            'authors', '{',
            'firstName', 'lastName', '}', '}',
          ]);
        });

        it('handles depths', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const depths = result.map((item) => item.depth);
          expect(depths).to.eql([
            0, //{
            1, //files
            1, //(
            1, //name
            1, //:
            1, //"
            1, //derp
            1, //"
            1, //)
            1, //{

            2, //...
            2, //fileFields

            1, //}
            0, //}

            0, //fragment
            0, //fileFields
            0, //on
            0, //ProjectFiles

            0, //{
            1, //type
            1, //name
            1, //extension
            1, //authors
            1, //{
            2, //firstName
            2, //lastName
            1, //}
            0, //}
          ]);
        });
      });
    });

    describe('Inline', () => {
      describe('simple', () => {
        const graphql = `
        {
          files(name: "derp") {
            ... on ImageFile {
              type
              name
            }
          }
        }`;

        it('handles definitions', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const definitions = result.map((item) => item.definition);
          expect(definitions).to.eql([
            dict.GROUP_START,
            dict.FIELD_BRANCH,
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,
            dict.GROUP_START,

            dict.ELLIPSIS,
            dict.ON_KEYWORD,
            dict.FRAGMENT_TYPE_NAME,

            dict.GROUP_START,
            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.GROUP_END,
            dict.GROUP_END,
            dict.GROUP_END,
          ]);
        });

        it('handles values', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const values = result.map((item) => item.value);
          expect(values).to.eql([
            '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
            '...', 'on', 'ImageFile', '{',
            'type',
            'name', '}', '}', '}',
          ]);
        });
      });

      describe('complex', () => {
        const graphql = `
        {
          files(name: "derp") {
            ... on ImageFile {
              type
              author {
                firstName
                lastName
              }
            }
          }
        }`;

        it('handles definitions', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const definitions = result.map((item) => item.definition);
          expect(definitions).to.eql([
            dict.GROUP_START,
            dict.FIELD_BRANCH,
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,
            dict.GROUP_START,

            dict.ELLIPSIS,
            dict.ON_KEYWORD,
            dict.FRAGMENT_TYPE_NAME,

            dict.GROUP_START,
            dict.FIELD_LEAF,
            dict.FIELD_BRANCH,
            dict.GROUP_START,
            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.GROUP_END,
            dict.GROUP_END,
            dict.GROUP_END,
            dict.GROUP_END,
          ]);
        });

        it('handles values', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const values = result.map((item) => item.value);
          expect(values).to.eql([
            '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
            '...', 'on', 'ImageFile', '{',
            'type',
            'author', '{',
            'firstName',
            'lastName', '}', '}', '}', '}',
          ]);
        });
      });

      describe('multiple', () => {
        const graphql = `
        {
          files(name: "derp") {
            ... on ImageFile {
              type
              name
            }
            ... on TextFile {
              type
              extension
            }
          }
        }`;

        it('handles definitions', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const definitions = result.map((item) => item.definition);
          expect(definitions).to.eql([
            dict.GROUP_START,
            dict.FIELD_BRANCH,
            dict.ARGUMENT_START,
            dict.ARGUMENT_NAME,
            dict.COLON,
            dict.QUOTES,
            dict.ARGUMENT_VALUE,
            dict.QUOTES,
            dict.ARGUMENT_END,
            dict.GROUP_START,

            dict.ELLIPSIS,
            dict.ON_KEYWORD,
            dict.FRAGMENT_TYPE_NAME,
            dict.GROUP_START,

            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.GROUP_END,

            dict.ELLIPSIS,
            dict.ON_KEYWORD,
            dict.FRAGMENT_TYPE_NAME,
            dict.GROUP_START,

            dict.FIELD_LEAF,
            dict.FIELD_LEAF,
            dict.GROUP_END,

            dict.GROUP_END,
            dict.GROUP_END,
          ]);
        });

        it('handles values', () => {
          const result = lexer.lex(tokenizer.tokenize(graphql));
          const values = result.map((item) => item.value);
          expect(values).to.eql([
            '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
            '...', 'on', 'ImageFile', '{',
            'type',
            'name',
            '}',
            '...', 'on', 'TextFile', '{',
            'type',
            'extension', '}', '}', '}',
          ]);
        });
      });

      describe('errors', () => {
        it('throws a syntax error when a fragment does not have a definition', () => {
          const graphql = `
          {
            files(name: "derp") {
              ...fileFields
            }
          }`;
          const tokens = tokenizer.tokenize(graphql);

          expect(() => lexer.lex(tokens)).to.throw(
            "Syntax error: Fragment 'fileFields' has no definition.  " +
            "Available fragment definitions: []");
        });

        it('throws a syntax error when a fragment is referenced but has no corresponding definition', () => {
          const graphql = `
          {
            files(name: "derp") {
              ...fileFields
            }
          }

          fragment somethingElse on ProjectFiles {
            type
            name
          }

          fragment notWhatYouUsed on ProjectFiles {
            type
            extension
          }`;
          const tokens = tokenizer.tokenize(graphql);

          expect(() => lexer.lex(tokens)).to.throw(
            "Syntax error: Fragment 'fileFields' has no definition.  " +
            "Available fragment definitions: [somethingElse, notWhatYouUsed]");
        });
      });
    });
  });

  describe('Lexing errors', () => {
    describe('Throws Syntax error', () => {
      it('When too many open curly braces', () => {
        const tokens = tokenizer.tokenize('{ bad { }');

        expect(() => lexer.lex(tokens)).to.throw("Syntax error: Found 2 '{' but only 1 '}'");
      });

      it('When too many close curly braces', () => {
        const tokens = tokenizer.tokenize('{ bad { } } }');

        expect(() => lexer.lex(tokens)).to.throw("Syntax error: Found 3 '}' but only 2 '{'");
      });
    });
  });
});
