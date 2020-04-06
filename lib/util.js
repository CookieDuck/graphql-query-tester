'use strict';

const R = require('ramda');

// greaterThanZero :: [a] -> Boolean
exports.greaterThanZero = R.compose(R.gt(R.__, 0), R.length);

// greaterThanOne :: [a] -> Boolean
exports.greaterThanOne = R.compose(R.gt(R.__, 1), R.length);

/**
 * Prints a table representing objects in the items array.
 * The table has a header, defined by strings in the columns array.
 *
 * Example:
 *  columns: ['id', 'name', 'value']
 *  items: [ { id: '1', name: 'Grace', value: 'High'}, { id: '2', name: 'Violetta', value: 'Invaluable' } ]
 *  indentation: 4
 *
 * then the following should be printed:
 *     id |     name |      value
 *     ---| -------- | ----------
 *      1 |    Grace |       High
 *      2 | Violetta | Invaluable
 *
 * @param columns  Array of strings.  They will be printed in the order received.
 * @param items  Array of objects.  Each object should have a property that corresponds to a value present in the columns array.
 * @param indentation  Number of spaces in front of the table.  Defaults to 0.
 */
exports.printTableForItems = (columns, items, indentation = 0) => {
  const maxWidths = columns.map((str) => str.length);

  const updateMaxWidths = (row, maxWidths) => {
    for (let i = 0; i < row.length; i++) {
      maxWidths[i] = Math.max(maxWidths[i], row[i].length);
    }
  };

  const rows = [columns];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    const row = [];
    for (let j = 0; j < columns.length; j++) {
      const fn = columns[j];
      const val = item[fn];
      row.push(val);
    }

    updateMaxWidths(row, maxWidths);
    rows.push(row);
  }

  const separator = maxWidths.map((len) => '-'.repeat(len));
  rows.splice(1, 0, separator);

  const indentString = ' '.repeat(indentation);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const formattedRow = row.map((item, index) => item.padStart(maxWidths[index])).join(' | ');
    console.log(`${indentString}${formattedRow}`);
  }
};
