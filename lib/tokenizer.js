exports.tokenize = function(str, debug = false) {
  const removedNewlines = removeNewlineCharacters(str);
  const paddedKeyCharacters = addSpaceAroundKeyCharacters(removedNewlines);
  const scrunchedDown = scrunchSpaces(paddedKeyCharacters);
  const trimmed = scrunchedDown.trim();
  const result = trimmed.split(' ');

  if (debug) {
    console.debug(`
      Input to parse: '${str}'
      After removing newlines: '${removedNewlines}'
      After adding whitespace around key characters: '${paddedKeyCharacters}'
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

const argumentCharacters = ['(', ':', '"', ',', ')',];
const fieldCharacters = ['{', '}'];
const fragmentStrings = ['...'];
let allKeyCharacters = [];
allKeyCharacters = allKeyCharacters.concat(argumentCharacters);
allKeyCharacters = allKeyCharacters.concat(fieldCharacters);
allKeyCharacters = allKeyCharacters.concat(fragmentStrings);

const addSpaceAroundKeyCharacters = function(str) {
  return allKeyCharacters.reduce(
    (accumulator, currentValue) => addWhitespaceAround(currentValue, accumulator),
    str
  );
};

const addWhitespaceAround = function(subString, totalString) {
  let lastIndex = totalString.lastIndexOf(subString);
  let result = totalString;
  while (lastIndex > -1) {
    if (lastIndex === 0) {
      return `${subString} ${result.substr(1)}`;
    }
    result = `${result.substr(0, lastIndex)} ${subString} ${result.substr(lastIndex + subString.length)}`;
    lastIndex = totalString.lastIndexOf(subString, lastIndex - 1);
  }
  return result;
};
