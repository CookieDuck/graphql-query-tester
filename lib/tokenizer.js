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
let allKeyCharacters = [];
allKeyCharacters = allKeyCharacters.concat(argumentCharacters);
allKeyCharacters = allKeyCharacters.concat(fieldCharacters);

const addSpaceAroundKeyCharacters = function(str) {
  return allKeyCharacters.reduce(
    (accumulator, currentValue) => addWhitespaceAround(currentValue, accumulator),
    str
  );
};

const addWhitespaceAround = function(char, str) {
  let lastIndex = str.lastIndexOf(char);
  let rtn = str;
  while (lastIndex > -1) {
    if (lastIndex === 0) {
      return `${char} ${rtn.substr(1)}`;
    }
    rtn = `${rtn.substr(0, lastIndex)} ${char} ${rtn.substr(lastIndex + 1)}`;
    lastIndex = str.lastIndexOf(char, lastIndex - 1);
  }
  return rtn;
};
