import { readLines } from "https://deno.land/std/io/mod.ts";
import { Onkun } from "https://raw.githubusercontent.com/marmooo/onkun/v0.2.6/mod.js";
import { YomiDict } from "npm:yomi-dict@0.1.4";
import { JKAT } from "npm:@marmooo/kanji@0.0.2";

async function getGradedWords(filepath, kanji) {
  const examples = [];
  const file = await Deno.open(filepath);
  for await (const line of readLines(file)) {
    if (!line) continue;
    const word = line.split(",")[0];
    if (word.includes(kanji)) {
      examples.push(word);
    }
  }
  file.close();
  return examples;
}

async function getGradedVocab(kanji, grade) {
  const filepath = "graded-vocab-ja/dist/" + (grade + 1) + ".csv";
  return await getGradedWords(filepath, kanji);
}

async function getGradedIdioms(kanji, grade) {
  const filepath = "graded-idioms-ja/dist/" + (grade + 1) + ".csv";
  return await getGradedWords(filepath, kanji);
}

async function getAdditionalIdioms(kanji) {
  const filepath = "additional-word.lst";
  return await getGradedWords(filepath, kanji);
}

function getYomis(kanji, grade) {
  const onkun = onkunDict.get(kanji);
  if (grade <= 9) {
    return onkun["Joyo"];
    // if (grade <= 5) {
    //   return onkun["小学"];
    // } else if (grade <= 7) {
    //   const yomis = [];
    //   yomis.push(...onkun["小学"]);
    //   yomis.push(...onkun["中学"]);
    //   return yomis;
    // } else if (grade <= 9){
    //   const yomis = [];
    //   yomis.push(...onkun["小学"]);
    //   yomis.push(...onkun["中学"]);
    //   yomis.push(...onkun["高校"]);
    //   return yomis;
  } else if (onkun) {
    return onkun["Unihan"];
  } else {
    console.log(`warning: ${kanji} onkun is undefined`);
    return [];
  }
}

async function loadAdditionalYomi(yomiDict) {
  const file = await Deno.open("additional-yomi.lst");
  for await (const line of readLines(file)) {
    if (!line) continue;
    const [word, yomi] = line.split("|");
    yomiDict.dict[word] = [yomi];
  }
  file.close();
}

async function build() {
  for (let grade = 0; grade < JKAT.length; grade++) {
    console.log(`grade ${grade}`);
    const info = {};
    for (const kanji of JKAT[grade]) {
      // 音訓 -> 手動 -> 基本語彙 -> 熟語の順番で登録する
      const yomis = getYomis(kanji, grade).flat();
      const set = new Set();
      set.add(kanji + "|" + yomis.join(","));
      const examples = new Set();
      const original = await getAdditionalIdioms(kanji);
      const vocab = await getGradedVocab(kanji, grade);
      const idioms = await getGradedIdioms(kanji, grade);
      original.forEach((word) => examples.add(word));
      vocab.forEach((word) => examples.add(word));
      idioms.forEach((word) => examples.add(word));
      [...examples].slice(0, 100).forEach((word) => {
        if (1 < word.length && word.length <= 5) {
          const yomis = yomiDict.get(word);
          if (yomis) {
            set.add(word + "|" + yomis.join(","));
          }
        }
      });
      info[kanji] = [...set];
      if (set.size < 6) {
        console.log(kanji + " < 6");
      }
    }
    Deno.writeTextFileSync(
      `dist/${grade + 1}.json`,
      JSON.stringify(info, null, 2),
    );
  }
}

const yomiDict = await YomiDict.fetch(
  "https://cdn.jsdelivr.net/npm/yomi-dict@0.1.4/esm/yomi.csv",
);
await loadAdditionalYomi(yomiDict);
const onkunDict = new Onkun();
await onkunDict.fetchJoyo(
  "https://raw.githubusercontent.com/marmooo/onkun/v0.2.6/data/joyo-2017.csv",
);
await onkunDict.fetch(
  "Joyo",
  "https://raw.githubusercontent.com/marmooo/onkun/v0.2.6/data/joyo-2010.csv",
);
await onkunDict.fetch(
  "Unihan",
  "https://raw.githubusercontent.com/marmooo/onkun/v0.2.6/data/Unihan-2023-07-15.csv",
);

await build();
