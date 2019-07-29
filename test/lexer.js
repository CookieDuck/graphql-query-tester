const expect = require('chai').expect;
const tokenizer = require('../lib/tokenizer');
const lexer = require('../lib/lexer');

describe('Lexer for tokens', function() {
  const dict = lexer.dictionary;

  it('Assigns definitions to tokens', function() {
    const graphql = '{ files }';
    const result = lexer.lex(tokenizer.parse(graphql));
    const definitions = result.map((item) => item.definition);
    expect(definitions).to.eql([dict.GROUP_START, dict.FIELD_SCALAR, dict.GROUP_END]);
  });
});
