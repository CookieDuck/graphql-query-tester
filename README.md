# graphql-query-utility
Utility library to test and format outgoing [GraphQL](https://graphql.org) queries.

## Installation
Unless you want to use the `format` method to trim out extra whitespace, this package
can be saved as a dev dependency via npm:
```
npm install graphql-query-utility --save-dev
```
or yarn:
```
yarn add graphql-query-utility --dev
```

If you want to use `format`, you'll need to install it as a normal dependency via npm:
```
npm install graphql-query-utility
```
or yarn:
```
yarn add graphql-query-utility
```

## Structure
When testing a query string, you programmatically define the `structure` with helper methods.
The helper methods are designed to approximately represent the shape of a GraphQL query string.
The helper methods generate `node` objects of a GraphQL `tree`.

##### query (alias: q)
`query` takes as many children nodes as you'd like to give it.  These children can include
`fragmentDeclaration` children.  Most queries will start with a `branch` or `branchWithArguments`

##### branch (alias: b)
`branch` takes a name (string), and as many children nodes as you'd like to give it.
Requires at least one child node.

##### branchWithArguments (alias: ba)
`branchWithArguments` takes a name (string), an array of `argument` nodes, and as many
children nodes as you'd like to give it.  Requires at least one child node.

##### leaf (alias: l)
`leaf` takes a name (string), and as many `argument` nodes as you'd like to give it
(including no `argument` nodes at all).

##### argument (alias: a)
`argument` takes a name (string), a value (string, or null), and a boolean
(true for 'quoted', false for 'unquoted').   'Quoted' means that the value
of the argument is surrounded by quotes, whereas 'unquoted' means that the
value does not have quotes surrounding it.

##### fragmentDeclaration (alias: fd)
`fragmentDeclaration` takes a name (string), a type reference (string), and as
many children nodes as you'd like to give it.  Requires at least one child node.
`fragmentDeclaration` nodes should only be child nodes of a `query` node.

##### fragment (alias: f)
`fragment` takes a name (string).  Should correspond to the name of a `fragmentDeclaration`
node.

##### inlineFragment (alias: if)
`inlineFragment` takes a name (string), and as many children as you'd like to give it.
Requires at least one child node.

## Example usages of structure
Verifying your query has correct structure in a unit test.  This example is using jest.
```javascript
import {
  argument,
  leaf,
  branchWithArguments,
  branch,
  fragment,
  inlineFragment,
  fragmentDeclaration,
  query,

  findErrors,
} from 'graphql-query-utility';

it('Outgoing query has expected structure', () => {
  /*
   In a real project you would likely have to extract the query from the code,
   possibly with mocks or argument capturing.
   This example just declares the query in the test.
  */
  const graphql = `
  {
    actors(limit: 5, sort: "ascending") {
      firstName
      lastName
      ... Thumbnail
      ... on Superstar {
        appearances {
          title
          actors(limit: 10) {
            firstName
            lastName
             ... Thumbnail
          }
        }
      }
    }
  }

  fragment Thumbnail on Person {
    imageUrl
    width
    height
  }`;

  /*
   Note the value parameter is set to `null` for each argument.
   For arguments, the value doesn't matter.  The last parameter
   (true or false) does matter.  Set it to true if the argument
   is surrounded by quotes, false if it is not.
  */
  const structure = query(
    branchWithArguments('actors',
      [
        argument('limit', null, false),
        argument('sort', null, true),
      ],
      leaf('firstName'),
      leaf('lastName'),
      fragment('Thumbnail'),
      inlineFragment('Superstar',
        branch('appearances',
          leaf('title'),
          branchWithArguments('actors',
            [
              argument('limit', null, false),
            ],
            leaf('firstName'),
            leaf('lastName'),
            fragment('Thumbnail'),
          ),
        ),
      ),
    ),
    fragmentDeclaration('Thumbnail', 'Person',
      leaf('imageUrl'),
      leaf('width'),
      leaf('height'),
    ),
  );

  expect(findErrors(graphql, structure)).toEqual([]);
});
```

Verifying your query has correct argument values in a unit test.  This example is using jest.
```javascript
import { argumentsAtPath } from 'graphql-query-utility';

it('has expected arguments and values', () => {
  /*
   In a real project you would likely have to extract the query from the code,
   possibly with mocks or argument capturing.
   This example just declares the query in the test.
  */
  const graphql = `
  {
    a
    b
    c {
      d
      e {
        f(arg1: "stuff", arg2: "more stuff", arg3: 5) {
          g
        }
      }
    }
  }`;

  /*
   argumentsAtPath uses a JSONPath-like syntax.  Each . indicates to "go in" one
   level into the query.
   */
  const actual = argumentsAtPath('c.e.f');
  expect(actual.length).toEqual(3);
  const arg1 = actual.find(arg => arg.name === 'arg1');
  const arg2 = actual.find(arg => arg.name === 'arg2');
  const arg3 = actual.find(arg => arg.name === 'arg3');

  /*
   Verify the values are as expected.  Depending on your test framework, you might
   expect that the values match a regular expression, or just have a specific value
   */
  expect(arg1.value).toEqual('stuff');
  expect(arg2.value).toEqual('more stuff');
  expect(arg3.value).toEqual('5');
});
```

## Formatting query string
Before sending your query string to a GraphQL server, you can remove redundant whitespace
with the `format` method.  This method takes your query string as the first argument.
By default, it preserves the order of your query.  If you would like to sort the query
alphabetically (preserves logical query structure), you can pass an optional configuration
argument second.  Current supported configuration options (with their default values):
```javascript
{
  preserveOrder: true // Keep query order intact when true, sort alphabetically when false
}
```

## Example usages of format

Formatting your query to remove extra whitespace
```javascript
import { format } from 'graphql-query-utility';

const graphql = `
{
  removes
  the
  extra
  whitespace {
    yet (it: "preserves   all   the   whitespace")
    inside (argumentValues: "that   have   quotes") {
      hooray
    }
  }
}`;

// By default, format preserves the order of the string
const formatted = format(graphql);
console.log('Formatted', formatted);
// { removes the extra whitespace { yet(it: "preserves   all   the   whitespace") inside(argumentValues: "that   have   quotes") { hooray } } }

// But it can be overridden if you want too sort each indentationo level alphabetically.
const sorted = format(graphql, { preserveOrder: false });
console.log('Sorted', sorted);
// { extra removes the whitespace { inside(argumentValues: "that   have   quotes") { hooray } yet(it: "preserves   all   the   whitespace") } }
```
