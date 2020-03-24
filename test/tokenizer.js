const expect = require('chai').expect;
const tokenizer = require('../lib/tokenizer');

describe('String tokenizer', () => {
  describe('Removes whitespace', () => {
    it('Handles huge swaths of whitespace between tokens', () => {
      const result = tokenizer.tokenize(`{           files                     }`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Removes leading and trailing whitespace', () => {
      const result = tokenizer.tokenize(`             { files }           `);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles newline characters', () => {
      const result = tokenizer.tokenize(`\n\n   \n
        {  \n
   \n     files \n
        }
      \n\n\n`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles carriage return characters', () => {
      const result = tokenizer.tokenize(`\r\r   \r
        {  \r
   \r     files \r
        }
      \r\r\r`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles tab characters', () => {
      const result = tokenizer.tokenize(`\t\t   \t
        {  \t
   \t     files \t
        }
      \t\t\t`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles a really funky (but legitimate) string', () => {
      const result = tokenizer.tokenize(`\r\r   \r
        {  \n\r
 \r\n\t   files \r\n
        }
      \r\t\r`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles a query that hates whitespace', () => {
      const result = tokenizer.tokenize(`{files}`);
      expect(result).to.eql(['{', 'files', '}']);
    });

    it('Handles a query that uses whitespace characters instead of spaces', () => {
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

  describe('Arguments', () => {
    describe('parsing types', function(){
      it('int', () => {
        const result = tokenizer.tokenize(`
        {
          files(limit: 3)
        }`);
        expect(result).to.eql(['{', 'files', '(', 'limit', ':', '3', ')', '}']);
      });

      it('float', () => {
        const result = tokenizer.tokenize(`
        {
          files(coolnessThreshold: 2.4)
        }`);
        expect(result).to.eql(['{', 'files', '(', 'coolnessThreshold', ':', '2.4', ')', '}']);
      });

      it('string', () => {
        const result = tokenizer.tokenize(`
        {
          files(extension: "txt")
        }`);
        expect(result).to.eql(['{', 'files', '(', 'extension', ':', '"', 'txt', '"', ')', '}']);
      });

      it('enum', () => {
        const result = tokenizer.tokenize(`
        {
          files(encoding: UTF_8)
        }`);
        expect(result).to.eql(['{', 'files', '(', 'encoding', ':', 'UTF_8', ')', '}']);
      });

      it('Handles multiple arguments on a field', () => {
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

      it('multiple arguments and a lack of whitespace', () => {
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

    it('Handles arguments on scalar fields', () => {
      const result = tokenizer.tokenize(`
      {
        files(name: "derp")
      }`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '}']);
    });

    it('Handles arguments on complex fields', () => {
      const result = tokenizer.tokenize(`
      {
        files(name: "derp") {
          extension
        }
      }`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{', 'extension', '}', '}']);
    });

    it('Handles arguments that have token characters inside', () => {
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

    it('Handles multiple string arguments', () => {
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

    it('Handles a lack of whitespace around tokens', () => {
      const result = tokenizer.tokenize(`{files(name:"derp"){extension name}}`);
      expect(result).to.eql(['{', 'files', '(', 'name', ':', '"', 'derp', '"', ')', '{', 'extension', 'name', '}', '}']);
    });
  });

  describe('Fragments', () => {
    describe('Normal', () => {
      it('handles simple', () => {
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

      it('handles complex', () => {
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

    describe('Inline', () => {
      it('handles simple', () => {
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

      it('handles complex', () => {
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

      it('handles multiple', () => {
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
