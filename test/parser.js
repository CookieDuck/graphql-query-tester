const expect = require('chai').expect;
const parser = require('../lib/parser');
const dict = require('../lib/lexer').dictionary;

describe('Parser for lexed tokens', function() {
  describe('Happy path', function() {
    it('Parses a simple query', function() {
      const graphql = `
      {
        files
        images
        users
      }`;

      const expected = {
        'root': {
          '_type': dict.FIELD_COMPLEX,
          '_value': 'root',
          'files': {
            '_type': dict.FIELD_SCALAR,
            '_value': 'files',
          },
          'images': {
            '_type': dict.FIELD_SCALAR,
            '_value': 'images',
          },
          'users': {
            '_type': dict.FIELD_SCALAR,
            '_value': 'users',
          },
        }
      };

      const result = parser.createAst(graphql);
      expect(result).to.eql(expected);
    });

    it('Parses a complex query', function() {
      const graphql = `
      {
        images {
          name
          extension
        }
        users
        resources {
          files {
            name
            extension
          }
          images {
            name
            extension
          }
        }
      }
      `;
      const expected = {
        'root': {
          '_type': dict.FIELD_COMPLEX,
          '_value': 'root',
          'images': {
            '_type': dict.FIELD_COMPLEX,
            '_value': 'images',
            'name': {
              '_type': dict.FIELD_COMPLEX,
              '_value': 'name',
            },
            'extension': {
              '_type': dict.FIELD_COMPLEX,
              '_value': 'extension',
            },
          },
          'users': {
            '_type': dict.FIELD_COMPLEX,
            '_value': 'users',
          },
          'resources': {
            'files': {
              'name': {
                '_type': dict.FIELD_COMPLEX,
                '_value': 'name',
              },
              'extension': {
                '_type': dict.FIELD_COMPLEX,
                '_value': 'extension',
              },
            },
            'images': {
              'name': {
                '_type': dict.FIELD_COMPLEX,
                '_value': 'name',
              },
              'extension': {
                '_type': dict.FIELD_COMPLEX,
                '_value': 'extension',
              },
            },
          },
        }
      };
      const result = parser.createAst(graphql);
      console.log('RESULT');
      console.log(result);
      expect(result).to.eql(expected);
    });

    it('Equivalent queries but in different order produce equivalent ASTs', function() {
      //TODO
      expect.fail();
    });
  });

  describe('Parse errors', function() {
    describe('Uneven curly braces', function() {
      it('Too many curly braces', function() {
        //TODO
        expect.fail();
      });

      it('Too few curly braces', function() {
        //TODO
        expect.fail();
      });
    })
  });
});