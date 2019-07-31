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
      const graphql1 = `
      {
        a
        b
        c {
          d
          e {
            f
          }
        }
      }`;
      const graphql2 = `
      {
        c {
          e {
            f
          }
          d
        }
        a
        b
      }`;
      const expected = root(
        scalar('a'),
        scalar('b'),
        complex('c',
          scalar('d'),
          complex('e',
            scalar('f'),
          ),
        ),
      );

      const result1 = parser.createAst(graphql1);
      expect(result1).to.eql(expected);

      const result2 = parser.createAst(graphql2);
      expect(result2).to.eql(expected);
    });
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
