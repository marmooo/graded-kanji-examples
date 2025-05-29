import { TextLineStream } from "jsr:@std/streams/text-line-stream";
import { Onkun } from "npm:onkun@0.3.0";
import { YomiDict } from "npm:yomi-dict@0.2.2";
import { JKAT } from "npm:@marmooo/kanji@0.0.8";

async function getGradedWords(filePath, kanji) {
  const examples = [];
  const file = await Deno.open(filePath);
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const line of lineStream) {
    const word = line.split(",")[0];
    if (word.includes(kanji)) {
      examples.push(word);
    }
  }
  return examples;
}

async function getGradedVocab(kanji, grade) {
  const filePath = "graded-vocab-ja/dist/" + (grade + 1) + ".csv";
  return await getGradedWords(filePath, kanji);
}

async function getGradedIdioms(kanji, grade) {
  const filePath = "graded-idioms-ja/dist/" + (grade + 1) + ".csv";
  return await getGradedWords(filePath, kanji);
}

async function getAdditionalIdioms(kanji) {
  const filePath = "additional-word.lst";
  return await getGradedWords(filePath, kanji);
}

async function loadAdditionalYomi(yomiDict) {
  const file = await Deno.open("additional-yomi.lst");
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const line of lineStream) {
    const [word, yomi] = line.split("|");
    yomiDict.dict[word] = [yomi];
  }
}

function getOnkun(kanji, grade) {
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

function getYomis(word) {
  const yomis = yomiDict.get(word);
  // ほとんどはうまくが、いくつか気になるものがあるので保留
  // 濁音と清音は SudachiDict 上でも区別するのは困難
  // 人人 --> ひとひと, ひとびと
  // 青竹 --> あおたけ, あおだけ
  // 大口 --> おおくち, おおぐち
  // if (yomis) {
  //   if (yomis.length == 1) return yomis;
  //   // はしる,ばしる --> はしる
  //   const unified = [];
  //   const checkSet = new Set();
  //   yomis.forEach((yomi) => {
  //     const normalized = yomi.normalize("NFD").replace(/[\u3099\u309a]/, "");
  //     if (!checkSet.has(normalized)) {
  //       unified.push(yomi);
  //       checkSet.add(normalized);
  //     }
  //   });
  //   return unified;
  // }
  return yomis;
}

async function build() {
  for (let grade = 0; grade < JKAT.length; grade++) {
    console.log(`grade ${grade}`);
    const info = {};
    for (const kanji of JKAT[grade]) {
      // 音訓 -> 手動 -> 基本語彙 -> 熟語の順番で登録する
      const yomis = getOnkun(kanji, grade).flat();
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
          const yomis = getYomis(word);
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

const yomiDict = await YomiDict.load("yomi-dict/yomi.csv");
await loadAdditionalYomi(yomiDict);
const onkunDict = new Onkun();
await onkunDict.loadJoyo("onkun/data/joyo-2017.csv");
await onkunDict.load("Joyo", "onkun/data/joyo-2010.csv");
await onkunDict.load("Unihan", "onkun/data/Unihan-2023-07-15.csv");

await build();
