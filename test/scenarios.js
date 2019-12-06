const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const { expect } = chai;

const parser = require('../lib/parser');
const util = require('./testUtility');
const {
  arg,
  scalar,
  complexWithArgs,
  complex,
  inlineFragment,
  fragmentDeclaration,
  fragment,
  root,
  rootWithFragments,
} = util;

describe('complex scenarios', function() {
  it('country details', function() {
    const identifier = "switzerland";
    const time = "2019-11-11T20:28:25.000Z";
    const limit = 50;
    const graphql = `
    {
      country(identifier: "${identifier}") {
        name
        description
        identifier
        flag {
          primary
          secondary
          ... on Complex {
            tertiary
            symbol {
              name
              primary
              secondary
              ... on ComplexSymbol {
                tertiary
              }
            }
          }
        }
        exports {
          regional {
            name
            description
            type
            quantity
          }
          global {
            name
          }
        }
        trains(timestamp: "${time}", limit:${limit}) {
          schedule {
            start
            end
            station {
              departing
              arriving
            }
          }
        }
      }
    }
    `;

    const expected = root(
      complexWithArgs('country', [
          arg('identifier', identifier, 'string'),
        ],
        scalar('name'),
        scalar('description'),
        scalar('identifier'),
        complex('flag',
          scalar('primary'),
          scalar('secondary'),
          inlineFragment('Complex',
            scalar('tertiary'),
            complex('symbol',
              scalar('name'),
              scalar('primary'),
              scalar('secondary'),
              inlineFragment('ComplexSymbol',
                scalar('tertiary'),
              ),
            ),
          ),
        ),
        complex('exports',
          complex('regional',
            scalar('name'),
            scalar('description'),
            scalar('type'),
            scalar('quantity'),
          ),
          complex('global',
            scalar('name'),
          ),
        ),
        complexWithArgs('trains', [
            arg('timestamp', time, 'string'),
            arg('limit', limit.toString(10), 'int'),
          ],
          complex('schedule',
            scalar('start'),
            scalar('end'),
            complex('station',
              scalar('departing'),
              scalar('arriving'),
            ),
          ),
        ),
      ),
    );
    const result = parser.parse(graphql);
    expect(result).to.deep.equalInAnyOrder(expected);
  });

  it('sports franchises with fragments', function() {
    const league = 'nhl';
    const teamName = 'Avalanche';
    const graphql = `
    {
      sport(league: "${league}") {
        franchise(name: "${teamName}") {
          ... TeamInfo
          rivals {
            ... TeamInfo
          }
        }
      }
    }

    fragment Person on Roster {
      firstName
      lastName
      imageUrl
    }

    fragment Record on TeamRecord {
      wins
      losses
      ties
    }

    fragment Logo on Image {
      imageUrl
      primaryColor
      secondaryColor
      aspectRatio
    }

    fragment TeamInfo on Franchise {
      name
      description
      roster {
        ... Person
      }
      logo {
        ... Logo
      }
      record {
        ... Record
      }
    }
    `;

    const expected = rootWithFragments(
      [
        fragmentDeclaration('Person', 'Roster',
          scalar('firstName'),
          scalar('lastName'),
          scalar('imageUrl'),
        ),
        fragmentDeclaration('Record', 'TeamRecord',
          scalar('wins'),
          scalar('losses'),
          scalar('ties'),
        ),
        fragmentDeclaration('Logo', 'Image',
          scalar('imageUrl'),
          scalar('primaryColor'),
          scalar('secondaryColor'),
          scalar('aspectRatio'),
        ),
        fragmentDeclaration('TeamInfo', 'Franchise',
          scalar('name'),
          scalar('description'),
          complex('roster',
            fragment('Person'),
          ),
          complex('logo',
            fragment('Logo'),
          ),
          complex('record',
            fragment('Record'),
          ),
        ),
      ],
      complexWithArgs('sport', [
          arg('league', league, 'string'),
        ],
        complexWithArgs('franchise', [
            arg('name', teamName, 'string'),
          ],
          fragment('TeamInfo'),
          complex('rivals',
            fragment('TeamInfo'),
          ),
        ),
      ),
    );
    const result = parser.parse(graphql);
    expect(result).to.deep.equalInAnyOrder(expected);
  });
});
