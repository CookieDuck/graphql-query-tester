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

    it('Handles a query that uses whitespace characters instead of spaces', function() {
      /*
      {
        a(arg1: "good") {
          b(arg1: 1)
          c
          ... on D {
            e
            ...f
          }
        }
      }

      fragment g on H {
        i
        j
      }
       */
      const result = tokenizer.tokenize(`
      {\ta(arg1:\t"good")\t{\tb(arg1:\t1)\tc\t...\ton\tD\t{\te...\tf\t}\t}\t}\tfragment\tg\ton\tH\t{\ti\tj\t}`);
      expect(result).to.eql([
        '{',
          'a', '(', 'arg1', ':', '"', 'good', '"', ')', '{',
            'b', '(', 'arg1', ':', '1', ')',
            'c',
            '...', 'on', 'D', '{',
               'e',
               '...', 'f',
            '}',
          '}',
        '}',
        'fragment', 'g', 'on', 'H', '{',
          'i',
          'j',
        '}',
      ]);
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

    it('Handles arguments that have token characters inside', function() {
      const specialCharacterArgument = '... , \\"{( : )}\\"';
      const result = tokenizer.tokenize(`
      {
        files(timestamp: "${specialCharacterArgument}") {
          extension
        }
      }`);
      expect(result).to.eql(['{', 'files', '(',
        'timestamp', ':', '"', specialCharacterArgument,
        '"', ')', '{', 'extension', '}', '}']);
    });

    it('Handles multiple string arguments', function() {
      const result = tokenizer.tokenize(`
      {
        files(name:"derp",type:"txt") {
          author(firstName:"jimenez") {
            lastName
          }
        }
      }`);
      expect(result).to.eql(['{', 'files', '(',
        'name', ':', '"', 'derp', '"', ',',
        'type', ':', '"', 'txt', '"',
        ')', '{', 'author', '(',
        'firstName', ':', '"', 'jimenez', '"',
        ')', '{', 'lastName', '}', '}', '}']);
    });

    it('Handles a lack of whitespace around tokens', function() {
      const result = tokenizer.tokenize(`{files(name:"derp"){extension name}}`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{', 'extension', 'name', '}', '}']);
    });
  });

  describe('Fragments', function() {
    describe('Normal', function() {
      it('handles simple', function() {
        const result = tokenizer.tokenize(`
        {
          files(name: "derp") {
            ...fileFields
          }
        }
        
        fragment fileFields on ProjectFiles {
          type
          name
        }`);

        expect(result).to.eql([
          '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
          '...', 'fileFields', '}', '}',
          'fragment', 'fileFields', 'on', 'ProjectFiles', '{',
          'type',
          'name', '}'
        ]);
      });

      it('handles complex', function() {
        const result = tokenizer.tokenize(`
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
        }`);

        expect(result).to.eql([
          '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
          '...', 'fileFields', '}', '}',
          'fragment', 'fileFields', 'on', 'ProjectFiles', '{',
          'type',
          'name',
          'extension',
          'authors', '{',
          'firstName',
          'lastName', '}', '}'
        ]);
      });
    });

    describe('Inline', function() {
      it('handles simple', function() {
        const result = tokenizer.tokenize(`
        {
          files(name: "derp") {
            ... on ImageFile {
              type
              name
            }
          }
        }`);

        expect(result).to.eql([
          '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
          '...', 'on', 'ImageFile', '{',
          'type',
          'name', '}', '}', '}'
        ]);
      });

      it('handles complex', function() {
        const result = tokenizer.tokenize(`
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
        }`);

        expect(result).to.eql([
          '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
          '...', 'on', 'ImageFile', '{',
          'type',
          'author', '{',
          'firstName',
          'lastName', '}', '}', '}', '}'
        ]);
      });

      it('handles multiple', function() {
        const result = tokenizer.tokenize(`
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
        }`);

        expect(result).to.eql([
          '{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{',
          '...', 'on', 'ImageFile', '{',
          'type',
          'name',
          '}',
          '...', 'on', 'TextFile', '{',
          'type',
          'extension', '}', '}', '}'
        ]);
      });
    });
  });
});
