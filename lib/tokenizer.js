exports.parse = function(str, debug = false) {
  const removedNewlines = removeNewlineCharacters(str);
  const scrunchedDown = scrunchSpaces(removedNewlines);
  const trimmed = scrunchedDown.trim();
  const result = trimmed.split(' ');

  if (debug) {
    console.debug(`
      Input to parse: '${str}'
      After removing newlines: '${removedNewlines}'
      After scrunching down whitespace: '${scrunchedDown}'
      After trimming: '${trimmed}'
      After splitting on ' ': '${result}'
    `);
  }

  return result;
};

const removeNewlineCharacters = function(str) {
  return str.replace(/(\r\n|\n|\r|\t)/g, '');
};

const scrunchSpaces = function(str) {
  return str.replace(/ +/g, ' ');
};
