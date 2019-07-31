const expect = require('chai').expect;
const tokenizer = require('../lib/tokenizer');

describe('String tokenizer', function() {
  describe('Removes whitespace', function() {
    it('Handles huge swaths of whitespace between tokens', function() {
      const result = tokenizer.tokenize(`{           files                     }`);
      expect(result).to.eql(['{', 'files', '}'])
    });

    it('Removes leading and trailing whitespace', function() {
      const result = tokenizer.tokenize(`             { files }           `);
      expect(result).to.eql(['{', 'files', '}'])
    });

    it('Handles newline characters', function() {
      const result = tokenizer.tokenize(`\n\n   \n
        {  \n
   \n     files \n
        }
      \n\n\n`);
      expect(result).to.eql(['{', 'files', '}'])
    });

    it('Handles carriage return characters', function() {
      const result = tokenizer.tokenize(`\r\r   \r
        {  \r
   \r     files \r
        }
      \r\r\r`);
      expect(result).to.eql(['{', 'files', '}'])
    });

    it('Handles tab characters', function() {
      const result = tokenizer.tokenize(`\t\t   \t
        {  \t
   \t     files \t
        }
      \t\t\t`);
      expect(result).to.eql(['{', 'files', '}'])
    });

    it('Handles a really funky (but legitimate) string', function() {
      const result = tokenizer.tokenize(`\r\r   \r
        {  \n\r
 \r\n\t   files \r\n
        }
      \r\t\r`);
      expect(result).to.eql(['{', 'files', '}'])
    });
  });
});