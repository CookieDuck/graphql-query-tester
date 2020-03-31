const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const { assert, expect } = chai;

const analyzer = require('../lib/analyzer');
const ARGUMENT_TYPE = require('../lib/structure').ARGUMENT_TYPE;
const dict = require('../lib/lexer').dictionary;
const {
  query,
  branch,
  branchWithArguments,
  argument,
  inlineFragment,
  leaf,
  fragmentDeclaration,
  fragment,
} = require('../lib/structure');
const { parse } = require('../lib/parser');

describe('Query analyzer', () => {
  describe('arguments', () => {
    it('can retrieve an arguments list at a path', () => {
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

    it('can walk inside inline fragments', () => {
      const graphql = `
      {
        ... on A {
          ... on B {
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

      expect(analyzer.argumentsAtPath(graphql, 'A.B.c')).to.eql(expected);
    });

    // TODO argumentsAtPath for fragment declarations (https://github.com/CookieDuck/graphql-query-tester/issues/19)

    it('reports how "far" it got when encountering a path does not exist', () => {
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

    it('reports how "far" it got when it stumbles, even on a long path', () => {
      const graphql = `
      {
        a {
          wontGetIt((arg1: "sorry")
        }
      }`;

      expect(analyzer.argumentsAtPath(graphql, 'a.b.c.d.e.f.g.h.i.j')).to.eql('b does not exist at path: a');
    });
  });

  describe('tree', () => {
    it('returns the subtree rooted at the requested path', () => {
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

    it('returns an error when the tree does not have the requested path', () => {
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

    // TODO treeAtPath for fragment declarations (https://github.com/CookieDuck/graphql-query-tester/issues/19)
  });
});

describe('Structure verifier', () => {
  it('returns true when the structure matches.  Argument values do not matter', () => {
    const graphql = `
    {
      b(arg2: "argument order doesn't need to be alphabetical", arg1: 123)
      a(argB: "won't matter", argC: "also irrelevant", argA: "not alphabetical") {
        d
        c(argY: 456, argX: 123) {
          ... on Test {
            someStuff
          }
        }
      }
    }`;
    const structure = query(
      branchWithArguments('a',
        [
          argument('argA', 'anything goes', true),
          argument('argB', 'anything goes', true),
          argument('argC', 'anything goes', true),
        ],
        branchWithArguments('c',
          [
            argument('argX', 'anything goes', false),
            argument('argY', 'anything goes', false),
          ],
          inlineFragment('Test',
            leaf('someStuff'),
          ),
        ),
        leaf('d'),
      ),
      leaf('b',
        argument('arg1', 'anything goes', false),
        argument('arg2', 'anything goes', true),
      ),
    );
    expect(analyzer.queryHasStructure(graphql, structure)).to.eql(true);
  });

  it('returns true when structure matches (includes fragment declarations)', () => {
    const graphql = `
    {
      ... frag
      a {
        c {
          ... frag2
        }
        b(argZ: 789, argY: 456, argX: 123)
      }
    }

    fragment frag on FragmentType1 {
      nodeA(limit: 2, apples: "no thanks") {
        nodeB
      }
    }

    fragment frag2 on FragmentType2 {
      more {
        names {
          are {
            hard(arg: ok)
          }
        }
      }
    }`;
    const structure = query(
      fragment('frag'),
      branch('a',
        branch('c',
          fragment('frag2'),
        ),
        leaf('b',
          argument('argZ', 'irrelevant', false),
          argument('argY', 'irrelevant', false),
          argument('argX', 'irrelevant', false),
        ),
      ),

      fragmentDeclaration('frag2', 'FragmentType2',
        branch('more',
          branch('names',
            branch('are',
              leaf('hard',
                argument('arg', 'irrelevant', false),
              ),
            ),
          ),
        ),
      ),

      fragmentDeclaration('frag', 'FragmentType1',
        branchWithArguments('nodeA',
          [
            argument('limit', 'irrelevant', false),
            argument('apples', 'irrelevant', true),
          ],
          leaf('nodeB'),
        ),
      ),
    );
    expect(analyzer.queryHasStructure(graphql, structure)).to.eql(true);
  });

  describe('reporting mismatches', () => {
    describe("structure matches, but arguments don't", () => {
      describe('mismatched quoting', () => {
        it('scenario: quoted vs. unquoted', () => {
          const graphql = `
          {
            a {
              b {
                c (quoted: "quoted")
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('quoted', 'irrelevant', false),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Argument 'quoted' at path a.b.c is quoted in GraphQL, but not structure",
          ]);
        });

        it('scenario: unquoted vs. quoted', () => {
          const graphql = `
          {
            a {
              b {
                c (unquoted: 123)
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('unquoted', 'irrelevant', true),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Argument 'unquoted' at path a.b.c is quoted in structure, but not GraphQL",
          ]);
        });
      });

      describe("query has arguments that structure doesn't", () => {
        it('scenario: leaf', () => {
          const graphql = `
          {
            a {
              b {
                c (present: "in both", only: "in query")
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('present', 'irrelevant', true),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing argument 'only' at path a.b.c",
          ]);
        });

        it('scenario: branch', () => {
          const graphql = `
          {
            a {
              b (present: "in both", only: "in query") {
                c
              }
            }
          }`;
          const structure = query(
            branch('a',
              branchWithArguments('b', [
                  argument('present', 'irrelevant', true),
                ],
                leaf('c'),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing argument 'only' at path a.b",
          ]);
        });

        it('scenario: inline fragment', () => {
          const graphql = `
          {
            a {
              ... on B {
                c(present: "in both", only: "in query")
              }
            }
          }`;
          const structure = query(
            branch('a',
              inlineFragment('B',
                leaf('c',
                  argument('present', 'irrelevant', true),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing argument 'only' at path a.B.c",
          ]);
        });

        // TODO mismatch in fragment declaration (https://github.com/CookieDuck/graphql-query-tester/issues/19)

        it('scenario: multiple failures', () => {
          const graphql = `
          {
            a(argA: "arg") {
              b(argB: "arg") {
                ... on c {
                  d(argD: "arg")
                }
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                inlineFragment('c',
                  leaf('d'),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing argument 'argA' at path a",
            "Structure is missing argument 'argB' at path a.b",
            "Structure is missing argument 'argD' at path a.b.c.d",
          ]);
        });
      });

      describe("structure has arguments that query doesn't", () => {
        it('scenario: leaf', () => {
          const graphql = `
          {
            a {
              b {
                c (present: "in both")
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('present', 'irrelevant', true),
                  argument('only', 'in structure', true),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing argument 'only' at path a.b.c",
          ]);
        });

        it('scenario: branch', () => {
          const graphql = `
          {
            a {
              b (present: "in both") {
                c
              }
            }
          }`;
          const structure = query(
            branch('a',
              branchWithArguments('b', [
                  argument('present', 'irrelevant', true),
                  argument('only', 'in structure', true),
                ],
                leaf('c'),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing argument 'only' at path a.b",
          ]);
        });

        it('scenario: inline fragment', () => {
          const graphql = `
          {
            a {
              ... on B {
                c(present: "in both")
              }
            }
          }`;
          const structure = query(
            branch('a',
              inlineFragment('B',
                leaf('c',
                  argument('present', 'irrelevant', true),
                  argument('only', 'in structure', true),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing argument 'only' at path a.B.c",
          ]);
        });

        // TODO mismatch in fragment declaration (https://github.com/CookieDuck/graphql-query-tester/issues/19)

        it('scenario: multiple failures', () => {
          const graphql = `
          {
            a {
              b {
                ... on c {
                  d
                }
              }
            }
          }`;
          const structure = query(
            branchWithArguments('a',
              [
                argument('argA', 'arg', true),
              ],
              branchWithArguments('b',
                [
                  argument('argB', 'arg', true),
                ],
                inlineFragment('c',
                  leaf('d',
                    argument('argD', 'arg', true),
                  ),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing argument 'argA' at path a",
            "Query is missing argument 'argB' at path a.b",
            "Query is missing argument 'argD' at path a.b.c.d",
          ]);
        });
      });
    });

    describe("arguments match, but structure doesn't", () => {
      //TODO consider different scenarios for each (fragment declarations, inlines, branches, leaves)
      //TODO query has stuff that structure doesn't
      describe("query has elements that structure doesn't", () => {
        it('scenario: extra leaves', () => {
          const graphql = `
          {
            a {
              b {
                c(arg: "arg")
                d
                e
              }
              f
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('arg', 'irrelevant', true),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing node: 'd' at path a.b",
            "Structure is missing node: 'e' at path a.b",
            "Structure is missing node: 'f' at path a",
          ]);
        });

        it('scenario: extra branches', () => {
          const graphql = `
          {
            a(arg: "arg") {
              b {
                c {
                  d {
                    e
                    missingOne {
                      first
                    } 
                  }
                }
              }
              missingTwo {
                second
              }
            }
          }`;
          const structure = query(
            branchWithArguments('a',
              [
                argument('arg', 'irrelevant', true),
              ],
              branch('b',
                branch('c',
                  branch('d',
                    leaf('e'),
                  ),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing node: 'missingOne' at path a.b.c.d",
            "Structure is missing node: 'missingTwo' at path a",
          ]);
        });

        it('scenario: extra inlines', () => {
          const graphql = `
          {
            a(arg: "arg") {
              b {
                c {
                  d {
                    e
                    ... on missingInline1 {
                      first
                    } 
                  }
                }
                ... on missingInline2 {
                  second
                }
              }
            }
          }`;
          const structure = query(
            branchWithArguments('a',
              [
                argument('arg', 'irrelevant', true),
              ],
              branch('b',
                branch('c',
                  branch('d',
                    leaf('e'),
                  ),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing node: 'missingInline1' at path a.b.c.d",
            "Structure is missing node: 'missingInline2' at path a.b",
          ]);
        });

        // TODO mismatch in fragment declaration (https://github.com/CookieDuck/graphql-query-tester/issues/19)

        it('scenario: multiple different failures', () => {
          const graphql = `
          {
            a(arg: "arg") {
              b {
                c {
                  d {
                    e
                    ... on missingInline {
                      inline
                    }
                    missingLeaf1
                  }
                  missingBranch {
                    branch
                  }
                }
                missingLeaf2
              }
            }
          }`;
          const structure = query(
            branchWithArguments('a',
              [
                argument('arg', 'irrelevant', true),
              ],
              branch('b',
                branch('c',
                  branch('d',
                    leaf('e'),
                  ),
                ),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Structure is missing node: 'missingInline' at path a.b.c.d",
            "Structure is missing node: 'missingLeaf1' at path a.b.c.d",
            "Structure is missing node: 'missingLeaf2' at path a.b",
            "Structure is missing node: 'missingBranch' at path a.b.c",
          ]);
        });
      });

      describe("structure has elements that query doesn't", () => {
        it('scenario: extra leaves', () => {
          const graphql = `
          {
            a {
              b {
                c(arg: "arg")
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('arg', 'irrelevant', true),
                ),
                leaf('extra1'),
              ),
              leaf('extra2'),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing node: 'extra1' at path a.b",
            "Query is missing node: 'extra2' at path a",
          ]);
        });

        it('scenario: extra branches', () => {
          const graphql = `
          {
            a {
              b {
                c(arg: "arg")
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('arg', 'irrelevant', true),
                ),
                branch('extra1',
                  leaf('notChecked'),
                ),
              ),
              branch('extra2',
                leaf('notChecked'),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing node: 'extra1' at path a.b",
            "Query is missing node: 'extra2' at path a",
          ]);
        });

        it('scenario: extra inlines', () => {
          const graphql = `
          {
            a {
              b {
                c(arg: "arg")
              }
            }
          }`;
          const structure = query(
            branch('a',
              branch('b',
                leaf('c',
                  argument('arg', 'irrelevant', true),
                ),
                inlineFragment('extraInline1',
                  leaf('notChecked'),
                ),
              ),
              inlineFragment('extraInline2',
                leaf('notChecked'),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing node: 'extraInline1' at path a.b",
            "Query is missing node: 'extraInline2' at path a",
          ]);
        });

        // TODO mismatch in fragment declaration (https://github.com/CookieDuck/graphql-query-tester/issues/19)

        it('scenario: multiple different failures', () => {
          const graphql = `
          {
            a(arg: "arg") {
              b {
                c {
                  d {
                    e
                  }
                }
              }
            }
          }`;
          const structure = query(
            branchWithArguments('a',
              [
                argument('arg', 'irrelevant', true),
              ],
              branch('b',
                branch('c',
                  branch('d',
                    leaf('e'),
                    inlineFragment('missingInline',
                      leaf('inline'),
                    ),
                    leaf('missingLeaf1'),
                  ),
                  branch('missingBranch',
                    leaf('branch'),
                  ),
                ),
                leaf('missingLeaf2'),
              ),
            ),
          );

          const errors = analyzer.findErrors(graphql, structure);
          expect(errors).to.deep.equalInAnyOrder([
            "Query is missing node: 'missingInline' at path a.b.c.d",
            "Query is missing node: 'missingLeaf1' at path a.b.c.d",
            "Query is missing node: 'missingLeaf2' at path a.b",
            "Query is missing node: 'missingBranch' at path a.b.c",
          ]);
        });
      });
    });
  });

  describe('malformed query/structure', () => {
    it('fails with error in query if query has error', () => {
      const graphql = `
      {
        noClosingCurlyForMe {
          b
      }`;
      const structure = query(
        branch('noClosingCurlyForMe',
          leaf('b'),
        ),
      );
      const expectedError = parse(graphql).error;
      assert.typeOf(expectedError, 'string');

      const errors = analyzer.findErrors(graphql, structure);
      expect(errors).to.deep.equalInAnyOrder([
        expectedError,
      ]);
    });

    it('fails with error in structure if structure has error', () => {
      const graphql = `
      {
        good {
          grand
        }
      }`;
      const structure = query(
        branch('good',
          leaf(), // leaves need non-empty strings for names, or its an error
        ),
      );
      const expectedError = structure.error;
      assert.typeOf(expectedError, 'string');

      const errors = analyzer.findErrors(graphql, structure);
      expect(errors).to.deep.equalInAnyOrder([
        expectedError,
      ]);
    });

    it('fails with both errors if query and structure contain errors', () => {
      const graphql = `
      {
        trash {
          bad
      }`;
      const graphqlError = parse(graphql).error;
      assert.typeOf(graphqlError, 'string');

      const structure = query(
        branch('good',
          leaf(), // leaves need non-empty strings for names, or its an error
        ),
      );
      const structureError = structure.error;
      assert.typeOf(structureError, 'string');

      const errors = analyzer.findErrors(graphql, structure);
      expect(errors).to.deep.equalInAnyOrder([
        graphqlError,
        structureError,
      ]);
    });
  });
});
