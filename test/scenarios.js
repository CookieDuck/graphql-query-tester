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
  root,
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
});
