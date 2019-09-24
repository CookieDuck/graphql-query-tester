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
      const expected = root(
        complex('images',
          scalar('name'),
          scalar('extension'),
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

      const result = parser.parse(graphql);
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

      const result1 = parser.parse(graphql1);
      expect(result1).to.eql(expected);

      const result2 = parser.parse(graphql2);
      expect(result2).to.eql(expected);
    });

    describe('Arguments', function() {
      describe('Types', function() {
        it('Int', function() {
          const graphql = '{ files(limit: 3) }';
          const expected = root(
            scalarWithArgs('files',
              arg( 'limit', '3', 'int'),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });

        it('Float', function() {
          const graphql = '{ files(coolnessThreshold: 2.4) }';
          const expected = root(
            scalarWithArgs('files',
              arg( 'coolnessThreshold', '2.4', 'float'),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });

        it('Enum', function() {
          const graphql = '{ files(encoding: UTF_8) }';
          const expected = root(
            scalarWithArgs('files',
              arg( 'encoding', 'UTF_8', 'enum'),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });

        it('String', function() {
          const graphql = '{ files(extension: "txt") }';
          const expected = root(
            scalarWithArgs('files',
              arg( 'extension', 'txt', 'string'),
            ),
          );
          expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
        });
      });

      it('can parse single argument on a scalar field', function() {
        const graphql = `
        {
          images {
            name(startsWith: "img")
          }
        }`;
        const expected = root(
          complex('images',
            scalarWithArgs('name',
              arg('startsWith', 'img', 'string')),
          ),
        );

        const result = parser.parse(graphql);
        expect(result).to.deep.equalInAnyOrder(expected);
      });

      it('can parse multiple arguments on a scalar field', function() {
        const graphql = '{ files(extension: "txt", limit: 3, fileEncoding: UTF_8) }';
        const expected = root(
          scalarWithArgs('files',
            arg( 'extension', 'txt', 'string'),
            arg( 'limit', '3', 'int'),
            arg( 'fileEncoding', 'UTF_8', 'enum'),
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
        const expected = root(
          complexWithArgs('images',
            [arg('type', 'jpg', 'string')],
            scalar('name'),
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
        const expected = root(
          complexWithArgs('files',
            [
              arg( 'extension', 'txt', 'string'),
              arg( 'limit', '3', 'int'),
              arg( 'fileEncoding', 'UTF_8', 'enum'),
            ],
            scalar('name'),
          ),
        );
        expect(parser.parse(graphql)).to.deep.equalInAnyOrder(expected);
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

          const expected = rootWithFragments(
            [
              fragmentDeclaration('fileFields', 'ProjectFiles',
                scalar('type'),
                scalar('name'),
              ),
            ],
            complexWithArgs('files',
              [
                arg('name', 'derp', 'string'),
              ],
              fragment('fileFields'),
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

          const expected = rootWithFragments(
            [
              fragmentDeclaration('fileFields', 'ProjectFiles',
                complex('author',
                  scalar('firstName'),
                  scalar('lastName'),
                  complex('address',
                    scalar('line1'),
                    scalar('zip'),
                  ),
                ),
                scalar('name'),
              ),
            ],
            complexWithArgs('files',
              [
                arg('name', 'derp', 'string'),
              ],
              fragment('fileFields'),
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

          const expected = rootWithFragments(
            [
              fragmentDeclaration('fileFields', 'ProjectFiles',
                complex('author',
                  scalar('firstName'),
                  scalar('lastName'),
                  complex('address',
                    scalar('line1'),
                    scalar('zip'),
                  ),
                ),
                scalar('name'),
              ),
              fragmentDeclaration('person', 'Person',
                scalar('firstName'),
                scalar('lastName'),
              ),
            ],
            complexWithArgs('files',
              [
                arg('name', 'derp', 'string'),
              ],
              fragment('fileFields'),
            ),
            complex('people',
              fragment('person'),
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

          const expected = root(
            complexWithArgs('files',
              [
                arg('name', 'derp', 'string'),
              ],
              inlineFragment('ImageFile',
                scalar('type'),
                scalar('name'),
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

          const expected = root(
            complex('files',
              inlineFragment('ImageFile',
                scalar('type'),
                scalar('name'),
              ),
              inlineFragment('TextFile',
                scalar('name'),
                complex('author',
                  scalar('firstName'),
                  scalar('lastName'),
                ),
              ),
            ),
          );
          const result = parser.parse(graphql);
          expect(result).to.deep.equalInAnyOrder(expected);
        });
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

// Helper functions
const arg = function(name, value, type) {
  return {
    name,
    value,
    type,
  };
};

const scalarWithArgs = function(value, ...arguments) {
  return {
    type: dict.FIELD_SCALAR,
    value,
    arguments,
  };
};

const scalar = function(value) {
  return scalarWithArgs(value)
};

const complexWithArgs = function(value, arguments = [], ...children) {
  return {
    type: dict.FIELD_COMPLEX,
    value,
    arguments,
    children,
  };
};

const complex = function(value, ...children) {
  return complexWithArgs(value, [], ...children);
};

const fragment = function(value) {
  return {
    type: dict.FRAGMENT_NAME,
    value,
  };
};

const inlineFragment = function(value, ...children) {
  return {
    type: dict.INLINE_FRAGMENT,
    value,
    children,
  };
};

const fragmentDeclaration = function(value, typeReference, ...children) {
  return {
    type: dict.FRAGMENT_DECLARATION,
    value,
    typeReference,
    children
  };
};

const root = function(...children) {
  const root = complex('root', ...children);
  root['fragments'] = [];
  return root;
};

const rootWithFragments = function(fragmentArray, ...children) {
  const rootNode = root(...children);
  rootNode['fragments'] = fragmentArray;
  return rootNode;
};
