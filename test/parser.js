const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const { expect } = chai;

const parser = require('../lib/parser');

const {
  argument,
  leaf,
  branchWithArguments,
  branch,
  fragment,
  inlineFragment,
  fragmentDeclaration,
  query,
} = require('../lib/structure');

describe('Parser for lexed tokens', function() {
  describe('Happy path', function() {
    it('Parses a simple query', function() {
      const graphql = `
      {
        files
        images
        users
      }`;
      const expected = query(
        leaf('files'),
        leaf('images'),
        leaf('users'),
      );

      const result = parser.parse(graphql);
      expect(result).to.eql(expected);
    });

    it('Parses a slightly complex query', function() {
      const graphql = `
      {
        images {
          name
          extension
        }
      }`;
      const expected = query(
        branch('images',
          leaf('name'),
          leaf('extension'),
        ),
      );

      const result = parser.parse(graphql);
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
      }`;
      const expected = query(
        branch('images',
          leaf('name'),
          leaf('extension'),
        ),
        leaf('users'),
        branch('resources',
          branch('files',
            leaf('name'),
            leaf('extension'),
          ),
          branch('images',
            leaf('name'),
            leaf('extension'),
          ),
        ),
      );

      const result = parser.parse(graphql);
      expect(result).to.deep.equalInAnyOrder(expected);
    });

    it('Equivalent queries but in different order produce equivalent ASTs when preserveOrder = false', function() {
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
      const expected = query(
        leaf('a'),
        leaf('b'),
        branch('c',
          leaf('d'),
          branch('e',
            leaf('f'),
          ),
        ),
      );

      const options = {
        preserveOrder: false,
      };
      const result1 = parser.parse(graphql1, options);
      expect(result1).to.eql(expected);

      const result2 = parser.parse(graphql2, options);
      expect(result2).to.eql(expected);
    });

    it('Equivalent queries in different order produce strictly ordered parsed ASTs when preserveOrder = true', function() {
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
      const expected1 = query(
        leaf('a'),
        leaf('b'),
        branch('c',
          leaf('d'),
          branch('e',
            leaf('f'),
          ),
        ),
      );

      const graphql2 = `
      {
        c {
          e {
            f
          }
          d
        }
        b
        a
      }`;
      const expected2 = query(
        branch('c',
          branch('e',
            leaf('f'),
          ),
          leaf('d'),
        ),
        leaf('b'),
        leaf('a'),
      );

      const options = {
        preserveOrder: true,
      };
      const result1 = parser.parse(graphql1, options);
      expect(result1).to.eql(expected1);

      const result2 = parser.parse(graphql2, options);
      expect(result2).to.eql(expected2);

      expect(result1).to.not.eql(result2);
    });

    describe('Arguments', function() {
      describe('Types', function() {
        it('Int', function() {
          const graphql = '{ files(limit: 3) }';
          const expected = query(
            leaf('files',
              argument( 'limit', '3', false),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });

        it('Float', function() {
          const graphql = '{ files(coolnessThreshold: 2.4) }';
          const expected = query(
            leaf('files',
              argument( 'coolnessThreshold', '2.4', false),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });

        it('Enum', function() {
          const graphql = '{ files(encoding: UTF_8) }';
          const expected = query(
            leaf('files',
              argument( 'encoding', 'UTF_8', false),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });

        it('String', function() {
          const graphql = '{ files(extension: "txt") }';
          const expected = query(
            leaf('files',
              argument( 'extension', 'txt', true),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });
      });

      it('can parse single argument on a leaf field', function() {
        const graphql = `
        {
          images {
            name(startsWith: "img")
          }
        }`;
        const expected = query(
          branch('images',
            leaf('name',
              argument('startsWith', 'img', true),
            ),
          ),
        );

        const result = parser.parse(graphql);
        expect(result).to.deep.equalInAnyOrder(expected);
      });

      it('can parse multiple arguments on a leaf field', function() {
        const graphql = '{ files(extension: "txt", limit: 3, fileEncoding: UTF_8) }';
        const expected = query(
          leaf('files',
            argument( 'extension', 'txt', true),
            argument( 'limit', '3', false),
            argument( 'fileEncoding', 'UTF_8', false),
          ),
        );
        expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
      });

      it('can parse multiple arguments on leaves and branches', function() {
        const graphql = `
        {
          a(arg1: "hi", arg2: 12, arg3: YO) {
            b(arg1: "boo")
            c
            d(arg1: "good", arg2: "ok") {
              e
              f
            }
          }
        }`;
        const expected = query(
          branchWithArguments('a',
            [
              argument('arg1', 'hi', true),
              argument('arg2', '12', false),
              argument('arg3', 'YO', false),
            ],
            leaf('b', argument('arg1', 'boo', true),),
            leaf('c'),
            branchWithArguments('d',
              [
                argument('arg1', 'good', true),
                argument('arg2', 'ok', true),
              ],
              leaf('e'),
              leaf('f'),
            ),
          ),
        );
        expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
      });

      it('can parse single argument on a complex field', function() {
        const graphql = `
        {
          images(type: "jpg") {
            name
          }
        }`;
        const expected = query(
          branchWithArguments('images',
            [argument('type', 'jpg', true)],
            leaf('name'),
          ),
        );

        const result = parser.parse(graphql);
        expect(result).to.deep.equalInAnyOrder(expected);
      });

      it('can parse multiple arguments on a complex field', function() {
        const graphql = `
        {
          files(extension: "txt", limit: 3, fileEncoding: UTF_8) {
            name
          }
        }`;
        const expected = query(
          branchWithArguments('files',
            [
              argument( 'extension', 'txt', true),
              argument( 'limit', '3', false),
              argument( 'fileEncoding', 'UTF_8', false),
            ],
            leaf('name'),
          ),
        );
        expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
      });

      it('can parse multiple arguments on different fields', function() {
        const graphql = `
        {
          files(extension: "txt") {
            name
            author(name: "timmy", limit:3) {
              lastName
            }
          }
        }`;

        const expected = query(
          branchWithArguments('files', [
              argument('extension', 'txt', true),
            ],
            leaf('name'),
            branchWithArguments('author', [
                argument('name', 'timmy', true),
                argument('limit', '3', false),
              ],
              leaf('lastName',),
            ),
          ),
        );
        const result = parser.parse(graphql);
        expect(result).to.deep.equalInAnyOrder(expected);
      });
    });

    describe('Fragments', function() {
      describe('Normal', function() {
        it('handles declaration of simple fragment', function() {
          const graphql = `
          {
            files(name: "derp") {
              ...fileFields
            }
          }

          fragment fileFields on ProjectFiles {
            type
            name
          }`;

          const expected = query(
            branchWithArguments('files',
              [
                argument('name', 'derp', true),
              ],
              fragment('fileFields'),
            ),
            fragmentDeclaration('fileFields', 'ProjectFiles',
              leaf('type'),
              leaf('name'),
            ),
          );

          const result = parser.parse(graphql);
          expect(result).to.deep.equalInAnyOrder(expected);
        });

        it('handles declaration of complex fragment', function() {
          const graphql = `{
            files(name: "derp") {
              ...fileFields
            }
          }

          fragment fileFields on ProjectFiles {
            author {
              firstName
              lastName
              address {
                line1
                zip
              }
            }
            name
          }`;

          const expected = query(
            branchWithArguments('files',
              [
                argument('name', 'derp', true),
              ],
              fragment('fileFields'),
            ),
            fragmentDeclaration('fileFields', 'ProjectFiles',
              branch('author',
                leaf('firstName'),
                leaf('lastName'),
                branch('address',
                  leaf('line1'),
                  leaf('zip'),
                ),
              ),
              leaf('name'),
            ),
          );

          const result = parser.parse(graphql);
          expect(result).to.deep.equalInAnyOrder(expected);
        });

        it('handles multiple declarations', function() {
          const graphql = `{
            files(name: "derp") {
              ...fileFields
            }
            people {
              ...person
            }
          }

          fragment fileFields on ProjectFiles {
            author {
              firstName
              lastName
              address {
                line1
                zip
              }
            }
            name
          }

          fragment person on Person {
            firstName
            lastName
          }`;

          const expected = query(
            branchWithArguments('files',
              [
                argument('name', 'derp', true),
              ],
              fragment('fileFields'),
            ),
            branch('people',
              fragment('person'),
            ),
            fragmentDeclaration('fileFields', 'ProjectFiles',
              branch('author',
                leaf('firstName'),
                leaf('lastName'),
                branch('address',
                  leaf('line1'),
                  leaf('zip'),
                ),
              ),
              leaf('name'),
            ),
            fragmentDeclaration('person', 'Person',
              leaf('firstName'),
              leaf('lastName'),
            ),
          );

          const result = parser.parse(graphql);
          expect(result).to.deep.equalInAnyOrder(expected);
        });
      });

      describe('Inline', function() {
        it('handles single', function() {
          const graphql = `
          {
            files(name: "derp") {
              ... on ImageFile {
                type
                name
              }
            }
          }`;

          const expected = query(
            branchWithArguments('files',
              [
                argument('name', 'derp', true),
              ],
              inlineFragment('ImageFile',
                leaf('type'),
                leaf('name'),
              ),
            ),
          );
          const result = parser.parse(graphql);
          expect(result).to.deep.equalInAnyOrder(expected);
        });

        it('handles multiple', function() {
          const graphql = `
          {
            files {
              ... on ImageFile {
                type
                name
              }
              ... on TextFile {
                name
                author {
                  firstName
                  lastName
                }
              }
            }
          }`;

          const expected = query(
            branch('files',
              inlineFragment('ImageFile',
                leaf('type'),
                leaf('name'),
              ),
              inlineFragment('TextFile',
                leaf('name'),
                branch('author',
                  leaf('firstName'),
                  leaf('lastName'),
                ),
              ),
            ),
          );
          const result = parser.parse(graphql);
          expect(result).to.deep.equalInAnyOrder(expected);
        });
      });

      it('Handles Fragment within a Fragment', function() {
        const graphql = `
        {
          files(limit: 20) {
            ... Files
          }
        }

        fragment Person on PersonType {
          firstName
          lastName
        }

        fragment Files on FileType {
          name
          type
          author {
            ... Person
          }
        }
        `;

        const expected = query(
          branchWithArguments('files', [
              argument('limit', '20', false),
            ],
            fragment('Files'),
          ),
          fragmentDeclaration('Person', 'PersonType',
            leaf('firstName'),
            leaf('lastName'),
          ),
          fragmentDeclaration('Files', 'FileType',
            leaf('name'),
            leaf('type'),
            branch('author',
              fragment('Person'),
            ),
          ),
        );
        const result = parser.parse(graphql);
        expect(result).to.deep.equalInAnyOrder(expected);
      });

      describe('Errors', function() {
        it('returns error when a fragment is declared but is not used', function() {
          const graphql = `
          {
            files(name: "derp") {
              type
            }
          }

          fragment fileFields on ProjectFiles {
            author {
              firstName
              lastName
            }
            name
          }`;

          const expectedError = "Syntax error: Fragment 'fileFields' is declared, but never used";
          const error = parser.parse(graphql).error;
          expect(error).to.equal(expectedError);
        });

        describe('Fragment declaration errors', function() {
          const expectedError = "Syntax error: Fragment 'fileFields' has no definition.  Available fragment definitions: []";

          it('when "fragment" keyword is not the first word', function () {
            const graphql = `
            {
              files {
                ...fileFields
              }
            }

            fileFields fragment on ProjectFiles {
              type
              name
            }`;
            const error = parser.parse(graphql).error;
            expect(error).to.equal(expectedError);
          });

          it('when fragment variable name is not between "fragment" and "on"', function() {
            const graphql = `
            {
              files {
                ...fileFields
              }
            }

            fragment on fileFields ProjectFiles {
              type
              name
            }`;
            const error = parser.parse(graphql).error;
            expect(error).to.equal(expectedError);
          });

          it('when "on" keyword is not between name and type', function() {
            const graphql = `
            {
              files {
                ...fileFields
              }
            }

            on fragment fileFields ProjectFiles {
              type
              name
            }`;
            const error = parser.parse(graphql).error;
            expect(error).to.equal(expectedError);
          });

          it('when type is not between "on" and "{"', function() {
            const graphql = `
            {
              files {
                ...fileFields
              }
            }

            fragment fileFields ProjectFiles on {
              type
              name
            }`;
            const error = parser.parse(graphql).error;
            expect(error).to.equal(expectedError);
          });
        });
      });
    });
  });

  describe('Sad path', function() {
    describe('Lexing errors', function() {
      describe('Returns object with error', function() {
        it('When too many open curly braces', function() {
          expect(parser.parse('{ bad { }').error).to.equal("Syntax error: Found 2 '{' but only 1 '}'");
        });

        it('When too many close curly braces', function() {
          expect(parser.parse('{ bad { } } }').error).to.equal("Syntax error: Found 3 '}' but only 2 '{'");
        });
      });
    });
  });
});
