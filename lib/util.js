'use strict';

const {
  __,
  always,
  compose,
  concat,
  curry,
  filter,
  gt,
  head,
  join,
  prop,
  propEq,
  propOr,
  length,
  map,
  max,
  pipe,
  reduce,
  tail,
  zip,
} = require('ramda');

// stringify :: a -> String
const stringify = (a) => a.toString();

// trace :: a -> a
const trace = (x) => {
  console.log(x);
  return x;
};

// repeatStringTimes :: String, Number -> String
const repeatStringTimes = curry((char, times) => char.repeat(times));

// greaterThanZero :: [a] -> Boolean
const greaterThanZero = compose(gt(__, 0), length);

// greaterThanOne :: [a] -> Boolean
const greaterThanOne = compose(gt(__, 1), length);

// printDebug :: [String], Integer, [Lexed] -> Void
const printDebug = curry((columns, depth, items) => {
  const generatePrintItem = (item) => reduce(
    (accumulator, current) => Object.assign({}, {
      ...accumulator,
      [current]: compose(stringify, propOr('unspecified', current))(item),
    }),
    {},
    columns,
  );

  const myItems = pipe(filter(propEq('depth', depth)), map(generatePrintItem))(items);
  const deeperItems = pipe(filter(compose(gt(__, depth), prop('depth'))), map(generatePrintItem))(items);

  const depthPadding = depth + 1;
  const indentString = repeatStringTimes(' ', depthPadding);

  console.log('');
  console.log(`${indentString}In recursiveParse for depth ${depth}`);
  console.log(`${indentString}My items:`);
  printTableForItems(columns, 4 * depthPadding, myItems);
  console.log(`${indentString}Deeper Items:`);
  printTableForItems(columns, 4 * depthPadding, deeperItems);
});

/**
 * Prints a table representing objects in the items array.
 * The table has a header, defined by strings in the columns array.
 *
 * Example:
 *  columns: ['id', 'name', 'value']
 *  indentation: 4
 *  items: [ { id: '1', name: 'Grace', value: 'High'}, { id: '2', name: 'Violetta', value: 'Invaluable' } ]
 *
 * then the following should be printed:
 *     id |     name |      value
 *     ---| -------- | ----------
 *      1 |    Grace |       High
 *      2 | Violetta | Invaluable
 *
 * @param columns  Array of strings.  They will be printed in the order received.
 * @param indentation  Number of spaces in front of the table.  Defaults to 0.
 * @param items  Array of objects.  Each object should have a property that corresponds to a value present in the columns array.
 */
const printTableForItems = (columns, indentation, items) => {
  const rowReducer = (accumulator, current) => [
    ...accumulator,
    map(prop(__, current), columns),
  ];
  const rows = reduce(rowReducer, [columns], items);

  const maxWidthReducer = (accumulator, current) => pipe(
      map(prop('length')),
      zip(accumulator),
      map(pair => max(pair[0], pair[1])),
    )(current);
  const maxWidths = reduce(maxWidthReducer, map(always(0), columns), rows);

  const headerAndTableSeparator = map(repeatStringTimes('-'), maxWidths);
  const table = [
    head(rows),
    headerAndTableSeparator,
    ...tail(rows),
  ];

  const indentString = repeatStringTimes(' ', indentation);
  const printRow = pipe(
    zip(maxWidths),
    map(pair => pair[1].padStart(pair[0])),
    join(' | '),
    concat(indentString),
    trace,
  );
  map(printRow, table);
};

module.exports = {
  greaterThanZero,
  greaterThanOne,
  printDebug,
  printTableForItems,
};
