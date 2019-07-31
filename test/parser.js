const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const { expect } = chai;

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
      const expected = root(
        scalar('files'),
        scalar('images'),
        scalar('users'),
      );

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
      const expected = root(
        complex('images',
          scalar('name'),
          scalar('extension'),
        ),
      );

      const result = parser.createAst(graphql);
      expect(result).to.deep.equalInAnyOrder(expected);
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
      const expected = root(
        complex('images',
          scalar('name'),
          scalar('extension'),
        ),
        scalar('users'),
        complex('resources',
          complex('files',
            scalar('name'),
            scalar('extension'),
          ),
          complex('images',
            scalar('name'),
            scalar('extension'),
          ),
        ),
      );

      const result = parser.createAst(graphql);
      expect(result).to.deep.equalInAnyOrder(expected);
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

// Helper functions
const complex = function(value, ...children) {
  return {
    'type': dict.FIELD_COMPLEX,
    'value': value,
    'children': children,
  };
};

const root = function(...children) {
  return complex('root', ...children);
};

const scalar = function(value) {
  return {
    'type': dict.FIELD_SCALAR,
    'value': value,
  };
};
