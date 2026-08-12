(function(){
  'use strict';
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
  function assignVariant(key, variants) {
    var h = hash(key + ':' + (localStorage.getItem('snowfluff-user') || 'anon'));
    return variants[h % variants.length];
  }
  window.__SNOW_VARIANTS__ = { assignVariant: assignVariant };
})();