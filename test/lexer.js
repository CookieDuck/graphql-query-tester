const expect = require('chai').expect;
const tokenizer = require('../lib/tokenizer');
const lexer = require('../lib/lexer');

describe('Lexer for tokens', function() {
  const dict = lexer.dictionary;

  it('Assigns values to tokens', function() {
    const graphql = '{ files }';
    const result = lexer.lex(tokenizer.parse(graphql));
    const values = result.map((item) => item.value);
    expect(values).to.eql(['{', 'files', '}']);
  });

  it('Assigns definitions to tokens', function() {
    const graphql = '{ paths { files } }';
    const result = lexer.lex(tokenizer.parse(graphql));
    const definitions = result.map((item) => item.definition);
    expect(definitions).to.eql([
      dict.GROUP_START,
      dict.FIELD_COMPLEX,
      dict.GROUP_START,
      dict.FIELD_SCALAR,
      dict.GROUP_END,
      dict.GROUP_END,
    ]);
  });

  it('Assigns indices to tokens', function() {
    const graphql = '{ files }';
    const result = lexer.lex(tokenizer.parse(graphql));
    const indices = result.map((item) => item.index);
    expect(indices).to.eql([0, 1, 2]);
  });

  it('Assigns depth to tokens', function() {
    //  depth indicates 'nesting', which is why 'paths' and its open and close braces are on depth 1
    //  Depth levels are closely related to 'proper' indentation
    //  0 1 2
    const graphql = `
        {
          paths {
            files
          }
        }`;
    const result = lexer.lex(tokenizer.parse(graphql));
    const depths = result.map((item) => item.depth);
    expect(depths).to.eql([0, 1, 1, 2, 1, 0]);
  });
});
