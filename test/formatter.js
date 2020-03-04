const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const { expect } = chai;

const parse = require('../lib/parser').parse;
const formatter = require('../lib/formatter');

const R = require('ramda');

describe('Formatter (whitespace stripper)', function() {
  function queriesProduceSameASTs(...queries) {
    if (queries.length < 2) {
      assert.fail('Invalid test setup.  Must have at least 2 queries to compare')
    }
    const tokenizedQueries = queries.map((query) => parse(query));
    const first = R.head(tokenizedQueries);
    const others = R.drop(1, tokenizedQueries);
    others.forEach(query => expect(query).to.deep.equalInAnyOrder(first));
  }

  function verifyFormatting(expected, input) {
    const result = formatter.format(input);
    expect(result).to.eql(expected);
    queriesProduceSameASTs(input, expected, result);
  }

  it('puts whitespace around curly braces and branch/leaf names', function() {
    const query = `
    {
      a {
        b
        c
        d {
          e
          f
        }
        g {
          h
        }
        i {
          j
          k
          l {
            m
          }
        }
        n  
      }
      o
      p
      q {
        r
      }
    }`;
    const expected = '{ a { b c d { e f } g { h } i { j k l { m } } n } o p q { r } }';
    verifyFormatting(expected, query);
  });

  it('puts aesthetically pleasing (to me) whitespace around arguments', function() {
    const query = `
    {
      a (arg1: "hi", arg2:   12, arg3:    YO   )  {
        b ( arg1: "boo")
        c
        d (arg1: "good" , arg2: "ok"){
          e
          f
        }
      }
    }`;
    const expected = '{ a(arg1: "hi", arg2: 12, arg3: YO) { b(arg1: "boo") c d(arg1: "good", arg2: "ok") { e f } } }';
    verifyFormatting(expected, query);
  });

  it('formats inline fragments correctly', function() {
    const query = `
    {
      files      {
        ...   on\r ImageFile {
          name\r\r\r\n
          type
        }
        ... on\nTextFile {
          author {
            firstName
            lastName
          }
          name
        }
      }
    }`;
    const expected = '{ files { ... on ImageFile { name type } ... on TextFile { author { firstName lastName } name } } }';
    verifyFormatting(expected, query);
  });

  it('formats fragments and their declarations correctly', function() {
    const query = `
    {
      a
      b {
         ... c
         d
         e
      }
      ...h
    }
    
    fragment c on C {
      f
      g
    }
    
    fragment h on H {
      ...c
      i
      j {
        k
      }
    }
    `;
    const expected = '{ a b { ...c d e } ...h } fragment c on C { f g } fragment h on H { ...c i j { k } }';
    verifyFormatting(expected, query);
  });

  it('can handle big, complicated scenarios', function() {
    const query = `
    {
      sport(league: "nhl") {
        franchise(name: "Avalanche") {
          ... TeamInfo
          rivals {
            ... TeamInfo
          }
        }
      }
    }

    fragment Person on Roster {
      firstName
      imageUrl
      lastName
    }

    fragment Record on TeamRecord {
      losses
      ties
      wins
    }

    fragment Logo on Image {
      aspectRatio
      imageUrl
      primaryColor
      secondaryColor
    }

    fragment TeamInfo on Franchise {
      description
      logo {
        ... Logo
      }
      name
      record {
        ... Record
      }
      roster {
        ... Person
      }
    }
    `;
    const expected =
      '{ sport(league: "nhl") { franchise(name: "Avalanche") { ...TeamInfo ' +
      'rivals { ...TeamInfo } } } } ' +
      'fragment Person on Roster { firstName imageUrl lastName } ' +
      'fragment Record on TeamRecord { losses ties wins } ' +
      'fragment Logo on Image { aspectRatio imageUrl primaryColor secondaryColor } ' +
      'fragment TeamInfo on Franchise { description logo { ...Logo } name record { ...Record } roster { ...Person } }';
    verifyFormatting(expected, query);
  });
});
