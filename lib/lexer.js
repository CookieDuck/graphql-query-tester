const dict = {
  GROUP_START: 'group start',
  GROUP_END: 'group end',
  FIELD_SCALAR: 'field (scalar)',
};

exports.lex = function(tokens, debug = false) {
  return [
    { definition: dict.GROUP_START },
    { definition: dict.FIELD_SCALAR },
    { definition: dict.GROUP_END },
  ];
};

exports.dictionary = dict;
