const tabula = require('tabula-js');
const t = tabula('/home/matsuda/workspace/kanji-dict/jyouyou_kanjihyou.pdf', {silent: true});
t.extractCsv((err, data) => console.log(err));
