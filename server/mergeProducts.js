'use strict';

function mergeProducts(defaults, customs) {
  const out = JSON.parse(JSON.stringify(defaults));
  if (!customs || typeof customs !== 'object') {
    return out;
  }
  Object.keys(customs).forEach(function (id) {
    if (customs[id]) {
      out[id] = customs[id];
    }
  });
  return out;
}

module.exports = { mergeProducts };
