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

    const expected = query(
      branchWithArguments('country', [
          argument('identifier', identifier, true),
        ],
        leaf('name'),
        leaf('description'),
        leaf('identifier'),
        branch('flag',
          leaf('primary'),
          leaf('secondary'),
          inlineFragment('Complex',
            leaf('tertiary'),
            branch('symbol',
              leaf('name'),
              leaf('primary'),
              leaf('secondary'),
              inlineFragment('ComplexSymbol',
                leaf('tertiary'),
              ),
            ),
          ),
        ),
        branch('exports',
          branch('regional',
            leaf('name'),
            leaf('description'),
            leaf('type'),
            leaf('quantity'),
          ),
          branch('global',
            leaf('name'),
          ),
        ),
        branchWithArguments('trains', [
            argument('timestamp', time, true),
            argument('limit', limit.toString(10), false),
          ],
          branch('schedule',
            leaf('start'),
            leaf('end'),
            branch('station',
              leaf('departing'),
              leaf('arriving'),
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

    const expected = query(
      branchWithArguments('sport', [
          argument('league', league, true),
        ],
        branchWithArguments('franchise', [
            argument('name', teamName, true),
          ],
          fragment('TeamInfo'),
          branch('rivals',
            fragment('TeamInfo'),
          ),
        ),
      ),
      fragmentDeclaration('Person', 'Roster',
        leaf('firstName'),
        leaf('lastName'),
        leaf('imageUrl'),
      ),
      fragmentDeclaration('Record', 'TeamRecord',
        leaf('wins'),
        leaf('losses'),
        leaf('ties'),
      ),
      fragmentDeclaration('Logo', 'Image',
        leaf('imageUrl'),
        leaf('primaryColor'),
        leaf('secondaryColor'),
        leaf('aspectRatio'),
      ),
      fragmentDeclaration('TeamInfo', 'Franchise',
        leaf('name'),
        leaf('description'),
        branch('roster',
          fragment('Person'),
        ),
        branch('logo',
          fragment('Logo'),
        ),
        branch('record',
          fragment('Record'),
        ),
      ),
    );
    const result = parser.parse(graphql);
    expect(result).to.deep.equalInAnyOrder(expected);
  });
});
