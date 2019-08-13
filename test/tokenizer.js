const expect = require('chai').expect;
const tokenizer = require('../lib/tokenizer');

describe('String tokenizer', function() {
  describe('Removes whitespace', function() {
    it('Handles huge swaths of whitespace between tokens', function() {
      const result = tokenizer.tokenize(`{           files                     }`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Removes leading and trailing whitespace', function() {
      const result = tokenizer.tokenize(`             { files }           `);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles newline characters', function() {
      const result = tokenizer.tokenize(`\n\n   \n
        {  \n
   \n     files \n
        }
      \n\n\n`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles carriage return characters', function() {
      const result = tokenizer.tokenize(`\r\r   \r
        {  \r
   \r     files \r
        }
      \r\r\r`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles tab characters', function() {
      const result = tokenizer.tokenize(`\t\t   \t
        {  \t
   \t     files \t
        }
      \t\t\t`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles a really funky (but legitimate) string', function() {
      const result = tokenizer.tokenize(`\r\r   \r
        {  \n\r
 \r\n\t   files \r\n
        }
      \r\t\r`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles a query that hates whitespace', function() {
      const result = tokenizer.tokenize(`{files}`);
      expect(result).to.eql(['{', 'files', '}']);
    });
  });

  describe('Arguments', function() {
    describe('parsing types', function(){
      it('int', function() {
        const result = tokenizer.tokenize(`
        {
          files(limit: 3)
        }`);
        expect(result).to.eql(['{', 'files', '(', 'limit', ':', '3', ')', '}']);
      });

      it('float', function() {
        const result = tokenizer.tokenize(`
        {
          files(coolnessThreshold: 2.4)
        }`);
        expect(result).to.eql(['{', 'files', '(', 'coolnessThreshold', ':', '2.4', ')', '}']);
      });

      it('string', function() {
        const result = tokenizer.tokenize(`
        {
          files(extension: "txt")
        }`);
        expect(result).to.eql(['{', 'files', '(', 'extension', ':', '"', 'txt', '"', ')', '}']);
      });

      it('enum', function() {
        const result = tokenizer.tokenize(`
        {
          files(encoding: UTF_8)
        }`);
        expect(result).to.eql(['{', 'files', '(', 'encoding', ':', 'UTF_8', ')', '}']);
      });

      it('Handles multiple arguments on a field', function() {
        const result = tokenizer.tokenize(`
        {
          files(limit: 3, encoding: UTF_8, extension: "txt", coolnessThreshold: 2.4)
        }`);
        expect(result).to.eql(['{', 'files', '(',
          'limit', ':', '3', ',',
          'encoding', ':', 'UTF_8', ',',
          'extension', ':', '"', 'txt', '"', ',',
          'coolnessThreshold', ':', '2.4',
          ')', '}']
        );
      });

      it('multiple arguments and a lack of whitespace', function() {
        const result = tokenizer.tokenize(`
        {files(limit:3,encoding:UTF_8,extension:"txt",coolnessThreshold:2.4)}`);
        expect(result).to.eql(['{', 'files', '(',
          'limit', ':', '3', ',',
          'encoding', ':', 'UTF_8', ',',
          'extension', ':', '"', 'txt', '"', ',',
          'coolnessThreshold', ':', '2.4',
          ')', '}']
        );
      });
    });

    it('Handles arguments on scalar fields', function() {
      const result = tokenizer.tokenize(`
      {
        files(name: "derp")
      }`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '}']);
    });

    it('Handles arguments on complex fields', function() {
      const result = tokenizer.tokenize(`
      {
        files(name: "derp") {
          extension
        }
      }`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{', 'extension', '}', '}']);
    });

    it('Handles a lack of whitespace around tokens', function() {
      const result = tokenizer.tokenize(`{files(name:"derp"){extension name}}`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{', 'extension', 'name', '}', '}']);
    });
  });
});
