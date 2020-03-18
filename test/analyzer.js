const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const { expect } = chai;

const analyzer = require('../lib/analyzer');

const ARGUMENT_TYPE = require('../lib/structure').ARGUMENT_TYPE;
const dict = require('../lib/lexer').dictionary;

describe('Query analyzer', function() {
  describe('arguments', function() {
    it('can retrieve an arguments list at a path', function() {
      const graphql = `
      {
        a {
          b {
            c(arg1: "i'm first", arg2: "me next", arg3: last) {
              d
            }
          }
        }
      }`;
      const expected = [
        {
          name: 'arg1',
          value: "i'm first",
          type: ARGUMENT_TYPE.QUOTED,
        },
        {
          name: 'arg2',
          value: "me next",
          type: ARGUMENT_TYPE.QUOTED,
        },
        {
          name: 'arg3',
          value: 'last',
          type: ARGUMENT_TYPE.UNQUOTED,
        },
      ];

      expect(analyzer.argumentsAtPath(graphql,'a.b.c')).to.eql(expected);
    });

    it('reports how "far" it got when encountering a path does not exist', function() {
      const graphql = `
      {
        a {
          b {
            d(arg1: "won't find me")
          }
        }
      }`;

      expect(analyzer.argumentsAtPath(graphql, 'a.b.c')).to.eql('c does not exist at path: a.b');
    });

    it('reports how "far" it got when it stumbles, even on a long path', function() {
      const graphql = `
      {
        a {
          wontGetIt((arg1: "sorry")
        }
      }`;

      expect(analyzer.argumentsAtPath(graphql, 'a.b.c.d.e.f.g.h.i.j')).to.eql('b does not exist at path: a');
    });
  });

  describe('tree', function() {
    it('returns the subtree rooted at the requested path', function() {
      const graphql = `
      {
        a {
          b {
            c(arg1: "i'm first", arg2: "me next", arg3: last) {
              d
            }
          }
        }
      }`;

      const subtree = {
        name: 'c',
        type: dict.FIELD_BRANCH,
        arguments: [
          {
            name: 'arg1',
            value: "i'm first",
            type: ARGUMENT_TYPE.QUOTED,
          },
          {
            name: 'arg2',
            value: "me next",
            type: ARGUMENT_TYPE.QUOTED,
          },
          {
            name: 'arg3',
            value: 'last',
            type: ARGUMENT_TYPE.UNQUOTED,
          },
        ],
        children: [
          {
            name: 'd',
            type: dict.FIELD_LEAF,
            arguments: [],
          },
        ],
      };
      expect(analyzer.treeAtPath(graphql, 'a.b.c')).to.eql(subtree);
    });

    it('returns an error when the tree does not have the requested path', function() {
      const graphql = `
      {
        a {
          b {
            c {
              bad {
                d {
                  e
                }
              }
            }
          }
        }
      }`;

      expect(analyzer.treeAtPath(graphql, 'a.b.c.d.e')).to.eql('d does not exist at path: a.b.c');
    });
  });
});
