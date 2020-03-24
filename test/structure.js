const chai = require('chai');
const { expect } = chai;

const dict = require('../lib/lexer').dictionary;
const {
  ARGUMENT_TYPE,
  argument,
  leaf,
  branch,
  branchWithArguments,
  fragmentDeclaration,
  fragment,
  inlineFragment,
  query,

  // terse aliases for above exports
  a,
  l,
  ba,
  b,
  fd,
  f,
  i,
  q
} = require('../lib/structure');

function noSpacesInNameTest(nodeGeneratorFn) {
  const illegalNames = ['i have spaces', 'i\thave\ttabs', 'i\nhave\nnewlines', 'i\rhave\rcarriage\rreturns'];
  illegalNames.forEach(name => {
    const node = nodeGeneratorFn(name);
    expect(node).to.have.own.property('error', 'name cannot contain whitespace');
    }
  );
}

describe('structure', () => {
  describe('argument', () => {
    const nameError = '"name" of argument must be a non-empty string';

    describe('omitting arguments passed to argument node', () => {
      it('type is assumed to be a string if argument node called with 2 arguments', () => {
        const name = 'nameForArg';
        const value = 'valueForArg';

        const actual = argument(name, value);

        expect(actual).to.have.own.property('name', name);
        expect(actual).to.have.own.property('value', value);
        expect(actual).to.have.own.property('type', ARGUMENT_TYPE.UNQUOTED);
      });

      it('value argument may be omitted (useful for validating structure)', () => {
        const name = 'nameOnly';

        const actual = argument(name);

        expect(actual).to.have.own.property('name', name);
        expect(actual).to.have.own.property('value', null);
        expect(actual).to.have.own.property('type', ARGUMENT_TYPE.UNQUOTED);
        expect(actual).not.to.have.own.property('error');
      });

      it('returns error object if all arguments absent', () => {
        expect(argument()).to.have.own.property('error', nameError);
      });
    });

    describe('"name" argument', () => {
      it('generates an error object if name is null', () => {
        expect(argument(null)).to.have.own.property('error', nameError);
      });

      it('generates an error object if name is undefined', () => {
        expect(argument(undefined)).to.have.own.property('error', nameError);
      });

      it('generates an error object if name is empty string', () => {
        expect(argument('')).to.have.own.property('error', nameError);
      });

      it('generates an error object if name contains spaces', () => {
        noSpacesInNameTest(argument);
      });

      it('uses the name argument passed to the argument node', () => {
        const name = 'nameToUse';
        const actual = argument(name);
        expect(actual).to.have.own.property('name', name);
        expect(actual).not.to.have.property('error');
      });
    });

    describe('"value" argument must be string or null,', () => {
      it('accepts type string for "value" argument ', () => {
        const value = 'myValue';
        const actual = argument('name', value);
        expect(actual).to.have.own.property('value', value);
      });

      it('accepts null for "value" argument ', () => {
        const actual = argument('name', null);
        expect(actual).to.have.own.property('value', null);
      });

      it('translates undefined for "value" argument into null', () => {
        const actual = argument('name', undefined);
        expect(actual).to.have.own.property('value', null);
      });

      describe('rejects non-string arguments', () => {
        const valueError = '"value" of argument must be null or a string';

        function runTest(value) {
          expect(argument('name', value).error).to.equal(valueError);
        }

        it('case: array', () => {
          runTest([]);
        });

        it('case: number', () => {
          runTest(123);
        });

        it('case: Object', () => {
          runTest({ data: 'derp' });
        });
      });
    });
  });

  describe('leaf', () => {
    const nameError = 'leaf requires a non-empty string for its name';

    describe('leaf name must be a non-empty string', () => {
      it ('has an error if given a non-string object for name', () => {
        expect(leaf(5)).to.have.own.property('error', nameError);
      });

      it('has an error if given an empty string for name', () => {
        expect(leaf('')).to.have.own.property('error', nameError);
      });

      it('generates an error object if name contains spaces', () => {
        noSpacesInNameTest(leaf);
      });
    });

    describe('no arguments', () => {
      function runTest(actualLeaf, expectedName) {
        expect(actualLeaf).to.have.own.property('name', expectedName);
        expect(actualLeaf).to.have.own.property('type', dict.FIELD_LEAF);
        expect(Array.isArray(actualLeaf.arguments)).to.equal(true);
        expect(actualLeaf.arguments.length).to.equal(0);
      }

      it('makes object without arguments', () => {
        runTest(leaf('name'), 'name');
      });

      it('makes object without arguments when null is passed for vararg', () => {
        runTest(leaf('name', null), 'name');
      });

      it('makes object without arguments when undefined is passed for vararg', () => {
        runTest(leaf('name', undefined), 'name');
      });

      it('makes object without arguments when [] is passed for vararg', () => {
        runTest(leaf('name', []), 'name');
      });

      it('has an error if constructed without a name', () => {
        expect(leaf()).to.have.own.property('error', nameError);
      });
    });

    describe('argument parsing', () => {
      it('makes object with "argument"s', () => {
        const arguments = [ argument('arg1'), argument('arg2') ];

        const actual = leaf('leafName', ...arguments);

        expect(actual.arguments.length).to.equal(2);
        expect(actual.arguments[0].name).to.equal('arg1');
        expect(actual.arguments[1].name).to.equal('arg2');
        expect(actual).to.not.have.own.property('error');
      });

      it('has an error when an argument has an error', () => {
        const actual = leaf('goodName',
          argument('valid arg 1'),
          argument(null),
          argument('valid arg 2'),
        );

        expect(actual.arguments.length).to.equal(3);
        expect(actual).to.have.own.property('error', 'one or more argument nodes contains an error');
      });

      it('has an error when given non-argument "arguments"', () => {
        const actual = leaf('goodName', { not: 'an argument' });
        expect(actual.arguments.length).to.equal(0);
        expect(actual).to.have.own.property('error', 'received an invalid argument object');
      });
    });
  });

  describe('branch', () => {
    describe('without "arguments"', () => {
      describe('branch name must be a non-empty string', () => {
        const nameError = 'branch name must be a non-empty string';

        it('has an error when name is not a string', () => {
          expect(branch(5)).to.have.own.property('error', nameError);
        });

        it('has an error when name is an empty string', () => {
          expect(branch('')).to.have.own.property('error', nameError);
        });

        it('generates an error object if name contains spaces', () => {
          noSpacesInNameTest(branch);
        });
      });

      describe('must have at least one child which has a type and name', () => {
        function runTest(name, child) {
          const actual = branch(name, child);

          expect(actual).to.have.own.property('name', name);
          expect(actual).to.have.own.property('type', dict.FIELD_BRANCH);
          expect(actual.children.length).to.equal(1);
          expect(actual.children[0]).to.have.own.property('name', child.name);
          expect(actual.arguments.length).to.equal(0);
          expect(actual).to.not.have.own.property('error');
        }

        it('accepts leaf', () => {
          runTest('branchName', leaf('leafName'));
        });

        it('accepts branch', () => {
          runTest('branchName', branch('subBranch', leaf('leaf')));
        });

        it('accepts fragment (reference)', () => {
          runTest('branchName', fragment('fragment'));
        });

        it('accepts fragment (inline)', () => {
          runTest('branchName', inlineFragment('inline', leaf('leafForInline')));
        });

        it('has an error if it receives no children', () => {
          expect(branch('nameOnly')).to.have.property('error', 'branch "nameOnly" must have at least one child');
        });
      });

      it('accepts multiple children', () => {
        const actual = branch('branchName',
          leaf('leaf1'),
          leaf('leaf2',
            argument('arg'),
          ),
          branch('subBranch',
            leaf('subLeaf1'),
            leaf('subLeaf2'),
          ),
          leaf('leaf3'),
        );

        expect(actual.children.length).to.equal(4);
        expect(actual.children[0]).to.have.own.property('name', 'leaf1');
        expect(actual.children[1]).to.have.own.property('name', 'leaf2');
        expect(actual.children[2]).to.have.own.property('name', 'subBranch');
        expect(actual.children[3]).to.have.own.property('name', 'leaf3');
        expect(actual).to.not.have.own.property('error');
      });

      it('has an error when a child has an error', () => {
        const actual = branch('willHaveError', leaf());

        expect(actual).to.have.own.property('error', 'branch "willHaveError" has one or more child nodes which have an error');
      });
    });

    describe('with "arguments"', () => {
      describe('must have at least one child which has a type and name', () => {
        function runTest(name, arguments, child) {
          const actual = branchWithArguments(name, arguments, child);

          expect(actual).to.have.own.property('name', name);
          expect(actual).to.have.own.property('type', dict.FIELD_BRANCH);
          expect(actual.children.length).to.equal(1);
          expect(actual.children[0].name).to.equal(child.name);
          expect(actual.arguments.length).to.equal(arguments.length);
          expect(actual).to.not.have.own.property('error');
        }

        const args = [ argument('argName') ];

        it('accepts leaf', () => {
          runTest('branchName', args, leaf('leafName'))
        });

        it('accepts branch', () => {
          runTest('branchName', args, branch('subBranch', leaf('subLeaf')));
        });

        it('accepts fragment (reference)', () => {
          runTest('branchName', args, fragment('fragment'));
        });

        it('accepts fragment (inline)', () => {
          runTest('branchName', args, inlineFragment('name', leaf('leafForInline')));
        });

        it('has an error if it receives no children', () => {
          expect(branchWithArguments('nameOnly', args)).to.have.property('error', 'branch "nameOnly" must have at least one child');
        });
      });

      it('has an error when an argument has an error', () => {
        const actual = branchWithArguments('willHaveError', [leaf()], leaf('good leaf'));

        expect(actual).to.have.own.property('error', 'branch "willHaveError" has one or more arguments which have an error');
      });

      it('generates an error object if name contains spaces', () => {
        noSpacesInNameTest(branchWithArguments);
      });

      it('accepts all arguments', () => {
        const arguments = [
          argument('1'),
          argument('2'),
          argument('3'),
          argument('4'),
          argument('5'),
          argument('6'),
          argument('7'),
          argument('8'),
        ];

        const actual = branchWithArguments('pentyOfArgs', arguments, leaf('goodLeaf'));

        expect(actual.arguments.length).to.equal(arguments.length);
      });

      it('accepts all children', () => {
        const children = [
          leaf('1'),
          leaf('2'),
          leaf('3'),
          leaf('4'),
          leaf('5'),
          leaf('6'),
          leaf('7'),
          leaf('8'),
        ];

        const actual = branchWithArguments('lotaOfKids', [], ...children);

        expect(actual.children.length).to.equal(children.length);
      });
    });
  });

  describe('fragments', () => {
    describe('declaration', () => {
      it('uses supplied name, type reference, and children', () => {
        const name = 'fragmentName';
        const typeReference = 'referencedType';
        const children = [ leaf('leafInFragment') ];

        const actual = fragmentDeclaration(name, typeReference, ...children);

        expect(actual.type).to.equal(dict.FRAGMENT_DECLARATION);
        expect(actual).to.have.own.property('name', name);
        expect(actual).to.have.own.property('typeReference', typeReference);
        expect(actual.children.length).to.equal(children.length);
        expect(actual.children[0].name).to.equal(children[0].name);
        expect(actual).to.not.have.own.property('error');
      });

      describe('requires valid name and type reference and at least one child', () => {
        describe('name', () => {
          const nameError = 'fragment declaration requires a non-empty string for its name';

          it('has an error when name is not a string', () => {
            const actual = fragmentDeclaration(1, 'typeReference', leaf('leaf'));

            expect(actual).to.have.own.property('error', nameError);
          });

          it('has an error when name is an empty string', () => {
            const actual = fragmentDeclaration('', 'typeReference', leaf('leaf'));

            expect(actual).to.have.own.property('error', nameError);
          });

          it('generates an error object if name contains spaces', () => {
            noSpacesInNameTest(fragmentDeclaration);
          });
        });

        describe('type reference', () => {
          const typeReferenceError = 'fragment declaration requires a non-empty string for its typeReference';

          it('has an error when type reference is not a string', () => {
            const actual = fragmentDeclaration('name', {}, leaf('leaf'));

            expect(actual.error).to.equal(typeReferenceError);
          });

          it('has an error when type reference is an empty string', () => {
            const actual = fragmentDeclaration('name', '', leaf('leaf'));

            expect(actual.error).to.equal(typeReferenceError);
          });
        });

        describe('children', () => {
          const invalidChildError = 'fragment declaration "name" requires at least one valid child node';

          it('has an error when no children are supplied', () => {
            const actual = fragmentDeclaration('name', 'typeReference');

            expect(actual.error).to.equal(invalidChildError);
          });

          it('has an error when none of the children are valid', () => {
            const actual = fragmentDeclaration('name', 'typeReference', { badNode: 'sorry'});

            expect(actual.error).to.equal(invalidChildError);
          });

          it('has an error when at least one of its children has an error', () => {
            const actual = fragmentDeclaration('childHasError', 'typeReference', leaf());

            expect(actual.error).to.equal('fragment declaration "childHasError" has one or more children which have an error');
          });
        });
      });
    });

    describe('reference', () => {
      it('has name and type', () => {
        const name = 'nameAsReferenceToFragmentDeclaration';
        const actual = fragment(name);

        expect(actual).to.have.own.property('name', name);
        expect(actual).to.have.own.property('type', dict.FRAGMENT_NAME);
        expect(actual).to.not.have.own.property('error');
      });

      describe('requires a non-empty string for a name', () => {
        const nameError = 'fragment reference requires a non-empty string';

        it('has an error when name is not a string', () => {
          expect(fragment(7)).to.have.own.property('error', nameError);
        });

        it('has an error when name is an empty string', () => {
          expect(fragment('')).to.have.own.property('error', nameError);
        });

        it('generates an error object if name contains spaces', () => {
          noSpacesInNameTest(fragment);
        });
      });
    });

    describe('inline', () => {
      it('uses supplied name and children', () => {
        const name = 'fragmentName';
        const children = [ leaf('leafInsideAnInlineFragment') ];

        const actual = inlineFragment(name, ...children);

        expect(actual).to.have.own.property('name', name);
        expect(actual).to.have.own.property('type', dict.INLINE_FRAGMENT);
        expect(actual.children.length).to.equal(children.length);
        expect(actual.children[0].name).to.equal(children[0].name);
        expect(actual).to.not.have.own.property('error');
      });

      describe('requires valid name and at least one child', () => {
        describe('name', () => {
          const nameError = 'inline fragment requires a non-empty string for its name';

          it('has an error when name is not a string', () => {
            const actual = inlineFragment(1, leaf('leaf'));

            expect(actual).to.have.own.property('error', nameError);
          });

          it('has an error when name is an empty string', () => {
            const actual = inlineFragment('', leaf('leaf'));

            expect(actual).to.have.own.property('error', nameError);
          });

          it('generates an error object if name contains spaces', () => {
            noSpacesInNameTest(inlineFragment);
          });
        });

        describe('children', () => {
          const invalidChildError = 'inline fragment "name" requires at least one valid child node';

          it('has an error when no children are supplied', () => {
            const actual = inlineFragment('name');

            expect(actual).to.have.own.property('error', invalidChildError);
          });

          it('has an error when none of the children are valid', () => {
            const actual = inlineFragment('name', { badNode: 'sorry'});

            expect(actual).to.have.own.property('error', invalidChildError);
          });

          it('has an error when at least one of its children has an error', () => {
            const actual = inlineFragment('childHasError', leaf());

            expect(actual).to.have.own.property('error', 'inline fragment "childHasError" has one or more children which have an error');
          });
        });
      });
    });
  });

  describe('query', () => {
    describe('must have at least one leaf or branch in its arguments', () => {
      it('cannot contain another query in its arguments', () => {
        const actual = query(query(leaf('leaf')));

        expect(actual).to.have.own.property('error', 'query cannot contain another query');
      });

      it('cannot contain an inline fragment in its arguments', () => {
        const actual = query(inlineFragment('validInline', leaf('leaf')));

        expect(actual).to.have.own.property('error', 'query cannot receive an inline fragment as an argument');
      });

      it('cannot be constructed with zero arguments', () => {
        const actual = query();

        expect(actual).to.have.own.property('error', 'query must receive at least one leaf or branch');
      });
    });

    describe('may have any combination of branches and leaves', () => {
      it('can have branches and no leaves (at root level)', () => {
        const children = [
          branch('branch1',
            leaf('branch1Leaf1')
          ),
          branchWithArguments('branch2',
            [argument('arg')],
            leaf('branch2Leaf1')
          ),
          branch('branch3',
            branch('branch3Branch3',
              leaf('branch3Branch3Leaf1'),
              leaf('branch3Branch3Leaf2')
            ),
            leaf('branch3Branch3Leaf1')
          ),
        ];

        const actual = query(...children);

        expect(actual.children.length).to.equal(children.length);
        expect(actual).to.not.have.own.property('error');
      });

      it('can have leaves and no branches (at root level)', () => {
        const children = [
          leaf('leaf1'),
          leaf('leaf2'),
          leaf('leaf3'),
          leaf('leaf4'),
          leaf('leaf5'),
          leaf('leaf6'),
        ];
        const actual = query(...children);

        expect(actual.children.length).to.equal(children.length);
        expect(actual).to.not.have.own.property('error');
      });

      it('can have both', () => {
        const children = [
          leaf('leaf1'),
          branch('branch1', leaf('branch1Leaf1')),
          leaf('leaf2'),
          branchWithArguments('branch2', [argument('arg')],
            leaf('branch2Leaf2'),
          ),
        ];
        const actual = query(...children);

        expect(actual.children.length).to.equal(children.length);
        expect(actual).to.not.have.own.property('error');
      });

      describe('can have fragment declarations', () => {
        it('as long as there is also at least one branch...', () => {
          const nodes = [
            branch('branch',
              leaf('leaf'),
            ),
            fragmentDeclaration('fragmentDeclaration', 'TypeReference',
              branch('fragmentBranch',
                leaf('fragmentBranchLeaf'),
              ),
              leaf('fragmentLeaf1'),
              leaf('fragmentLeaf2'),
            ),
          ];

          const actual = query(...nodes);

          expect(actual.children.length).to.equal(1);
          expect(actual.fragmentDeclarations.length).to.equal(1);
          expect(actual).to.not.have.own.property('error');
        });

        it('...or as long as there is also at least one leaf', () => {
          const nodes = [
            fragmentDeclaration('fragmentDeclaration1', 'TypeReference',
              branch('fragment1Branch',
                leaf('fragment1Branch-leaf'),
              ),
              leaf('fragment1Leaf1'),
              leaf('fragment1Leaf2'),
            ),
            fragmentDeclaration('fragmentDeclaration2', 'TypeReference2',
              leaf('fragment2Leaf1'),
            ),
            leaf('leaf'),
          ];

          const actual = query(...nodes);

          expect(actual.children.length).to.equal(1);
          expect(actual.fragmentDeclarations.length).to.equal(2);
          expect(actual).to.not.have.own.property('error');
        });
      });
    });

    describe('errors', () => {
      it('has an error if any fragment declarations have an error', () => {
        const nodes = [
          fragmentDeclaration('iHaveAnError', {},
            leaf('leaf'),
          ),
          leaf('leaf'),
        ];

        const actual = query(...nodes);

        expect(actual.children.length).to.equal(1);
        expect(actual.fragmentDeclarations.length).to.equal(1);
        expect(actual).to.have.own.property('error', 'query has one or more fragmentDeclarations which have an error');
      });

      it('has an error if any branches or leaves have an error', () => {
        const nodes = [
          fragmentDeclaration('fragmentDeclaration', 'typeReference',
            leaf('leaf'),
          ),
          branch('branchWithError'),
        ];

        const actual = query(...nodes);

        expect(actual.children.length).to.equal(1);
        expect(actual.fragmentDeclarations.length).to.equal(1);
        expect(actual).to.have.own.property('error', 'query has one or more children which have an error');
      });
    });
  });
});

describe('examples', () => {
  function hasError(node) {
    if (node.hasOwnProperty('error') && typeof node.error === 'string') {
      return true;
    }
    const keysThatHaveArrayValues = Object.keys(node).filter(key => Array.isArray(node[key]));
    for (let i = 0; i < keysThatHaveArrayValues.length; i++) {
      const arrayValue = node[keysThatHaveArrayValues[i]];
      for (let j = 0; j < arrayValue.length; j++) {
        if (hasError(arrayValue[j])) {
          return true;
        }
      }
    }

    return false;
  }

  it('valid query will be made of nodes that do not have an error prop', () => {
    const tree = query(
      branch('olympics',
        fragment('participants'),
        branch('schedule',
          branchWithArguments('location',
            [
              argument('sport', 'diving', true),
            ],
            branch('address',
              leaf('line1'),
              leaf('line2'),
              leaf('city'),
              leaf('country'),
            ),
          ),
        ),
        fragment('events'),
        leaf('name'),
      ),
      fragmentDeclaration('participants', 'People',
        leaf('name'),
        branch('country',
          leaf('name'),
          leaf('hemisphere'),
          inlineFragment('someInlineFragment',
            branch('branch',
              leaf('leaf1'),
              leaf('leaf2'),
            ),
          ),
        ),
      ),
      fragmentDeclaration('events', 'Events',
        leaf('name'),
        branchWithArguments('duration',
          [
            argument('type', 'scheduled'),
            argument('limit', '2'),
            argument('after', '2020-06-07', true),
          ],
          leaf('type'),
          leaf('name'),
        ),
      ),
    );

    expect(hasError(tree)).to.equal(false);
  });

  it('valid query with lots of depth has no nodes with an error prop', () => {
    const tree = query(
      branch('1',
        branch('2',
          branch('3',
            branch('4',
              branch('5',
                branch('6',
                  branch('7',
                    branch('8',
                      branch('9',
                        branch('10',
                          branch('11',
                            branch('12',
                              branch('13',
                                branch('14',
                                  leaf('15'),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    expect(hasError(tree)).to.equal(false);
  });

  it('aliases work', () => {
    const tree = q(
      b('olympics',
        f('participants'),
        b('schedule',
          ba('location',
            [
              a('sport', 'diving', true),
            ],
            b('address',
              l('line1'),
              l('line2'),
              l('city'),
              l('country'),
            ),
          ),
        ),
        f('events'),
        l('name'),
      ),
      fd('participants', 'People',
        l('name'),
        b('country',
          l('name'),
          l('hemisphere'),
          i('someInlineFragment',
            b('branch',
              l('leaf1'),
              l('leaf2'),
            ),
          ),
        ),
      ),
      fd('events', 'Events',
        l('name'),
        ba('duration',
          [
            a('type', 'scheduled'),
            a('limit', '2'),
            a('after', '2020-06-07', true),
          ],
          l('type'),
          l('name'),
        ),
      ),
    );

    expect(hasError(tree)).to.equal(false);
  });
});
