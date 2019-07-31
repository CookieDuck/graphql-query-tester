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
        'type': dict.FIELD_COMPLEX,
        'value': 'root',
        'children': [
          {
            'type': dict.FIELD_SCALAR,
            'value': 'files',
          },
          {
            'type': dict.FIELD_SCALAR,
            'value': 'images',
          },
          {
            'type': dict.FIELD_SCALAR,
            'value': 'users',
          },
        ],
      };

      const result = parser.createAst(graphql);
      expect(result).to.eql(expected);
    });

    it('Parses a slightly complex query', function() {
      const graphql = `
      {
        images {
          name
          extension
        }
      }
      `;
      const expected = {
        'type': dict.FIELD_COMPLEX,
        'value': 'root',
        'children': [
          {
            'type': dict.FIELD_COMPLEX,
            'value': 'images',
            'children': [
              {
                'type': dict.FIELD_SCALAR,
                'value': 'name',
              },
              {
                'type': dict.FIELD_SCALAR,
                'value': 'extension',
              },
            ],
          },
        ],
      };

      const result = parser.createAst(graphql);
      expect(result).to.eql(expected);
    });

    it('Parses a more complex query', function() {
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
        'type': dict.FIELD_COMPLEX,
        'value': 'root',
        'children': [
          {
            'type': dict.FIELD_SCALAR,
            'value': 'users',
          },
          {
            'type': dict.FIELD_COMPLEX,
            'value': 'images',
            'children': [
              {
                'type': dict.FIELD_SCALAR,
                'value': 'name',
              },
              {
                'type': dict.FIELD_SCALAR,
                'value': 'extension',
              },
            ],
          },
          {
            'type': dict.FIELD_COMPLEX,
            'value': 'resources',
            'children': [
              {
                'type': dict.FIELD_COMPLEX,
                'value': 'files',
                'children': [
                  {
                    'type': dict.FIELD_SCALAR,
                    'value': 'name',
                  },
                  {
                    'type': dict.FIELD_SCALAR,
                    'value': 'extension'
                  },
                ],
              },
              {
                'type': dict.FIELD_COMPLEX,
                'value': 'images',
                'children': [
                  {
                    'type': dict.FIELD_SCALAR,
                    'value': 'name',
                  },
                  {
                    'type': dict.FIELD_SCALAR,
                    'value': 'extension'
                  },
                ],
              },
            ],
          },
        ],
      };

      //TODO write helper tree builder functions for tests
      const result = parser.createAst(graphql);
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