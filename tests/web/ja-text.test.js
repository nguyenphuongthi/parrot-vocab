// Chữ Nhật: furigana tự động, romaji (Hepburn, trợ từ は/へ/を), gõ romaji → kana, chia động từ / tính từ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerKey, furiganaOf, jaPlain, jaReading, jaRomaji, jaSegments, romajiToKana, toRomaji } from '../../src/features/ja/text.js';
import { conjugate } from '../../src/features/ja/conjugate.js';
import { checkJaText } from '../../scripts/lib/ja-text.mjs';

test('furigana tự động ghép theo từng cụm chữ Hán', () => {
  assert.equal(furiganaOf('食べる', 'たべる'), '{食|た}べる');
  assert.equal(furiganaOf('お父さん', 'おとうさん'), 'お{父|とう}さん');
  assert.equal(furiganaOf('食べ物', 'たべもの'), '{食|た}べ{物|もの}');
  assert.equal(furiganaOf('男の子', 'おとこのこ'), '{男|おとこ}の{子|こ}');
  assert.equal(furiganaOf('消しゴム', 'けしゴム'), '{消|け}しゴム');
  assert.equal(furiganaOf('一人', 'ひとり'), '{一人|ひとり}');
  assert.equal(furiganaOf('コーヒー', ''), 'コーヒー');
});

test('câu có đánh dấu: chữ hiển thị, cách đọc, romaji, đoạn furigana', () => {
  const s = '{私|わたし} は 【{学生|がくせい}】 です。';
  assert.equal(jaPlain(s), '私は学生です。');
  assert.equal(jaReading(s), 'わたし は がくせい です。');
  assert.equal(jaRomaji(s), 'watashi wa gakusei desu.');
  assert.deepEqual(jaSegments(s), [
    { text: '私', rt: 'わたし', mark: false },
    { text: 'は', mark: false },
    { text: '学生', rt: 'がくせい', mark: true },
    { text: 'です。', mark: false },
  ]);
  assert.equal(jaRomaji('{学校|がっこう} へ {行|い}きます。'), 'gakkou e ikimasu.');
  assert.equal(jaRomaji('パン を {食|た}べます。'), 'pan o tabemasu.');
});

test('romaji Hepburn: âm ghép, っ, ん, trường âm katakana', () => {
  const cases = {
    きょう: 'kyou',
    しゃしん: 'shashin',
    ちょっと: 'chotto',
    きって: 'kitte',
    まっちゃ: 'matcha',
    きんようび: "kin'youbi",
    ほんや: "hon'ya",
    しんぶん: 'shinbun',
    コーヒー: 'koohii',
    パーティー: 'paatii',
    ふじさん: 'fujisan',
    つくえ: 'tsukue',
    じしょ: 'jisho',
    こんにちは: 'konnichiwa',
  };
  for (const [kana, rm] of Object.entries(cases)) assert.equal(toRomaji(kana, { particles: false }), rm, kana);
  // Từ vựng 歯 (は) không phải trợ từ
  assert.equal(toRomaji('は', { particles: false }), 'ha');
  assert.equal(toRomaji('は'), 'wa');
});

test('gõ romaji → kana và so đáp án', () => {
  assert.equal(romajiToKana('konnichiwa'), 'こんにちわ');
  assert.equal(romajiToKana('onna'), 'おんな');
  assert.equal(romajiToKana("kin'youbi"), 'きんようび');
  assert.equal(romajiToKana('kitte'), 'きって');
  assert.equal(romajiToKana('tyotto'), 'ちょっと');
  // Hepburn và kiểu gõ IME cho cùng một đáp án
  assert.equal(answerKey('shinbun'), answerKey('sinbun'));
  assert.equal(answerKey('tsukue'), answerKey('tukue'));
  assert.equal(answerKey('konnichiwa'), answerKey('konnichiha'));
  assert.equal(answerKey('コーヒー'), 'こーひー');
  assert.equal(answerKey('食べる'), '食べる');
});

test('chia động từ ba nhóm và tính từ', () => {
  const v = (w, t) => Object.values(conjugate(w, t));
  assert.deepEqual(v('{書|か}く', 'v1'), ['{書|か}きます', '{書|か}いて', '{書|か}かない', '{書|か}いた']);
  assert.deepEqual(v('{行|い}く', 'v1'), ['{行|い}きます', '{行|い}って', '{行|い}かない', '{行|い}った']);
  assert.deepEqual(v('{買|か}う', 'v1'), ['{買|か}います', '{買|か}って', '{買|か}わない', '{買|か}った']);
  assert.deepEqual(v('{飲|の}む', 'v1'), ['{飲|の}みます', '{飲|の}んで', '{飲|の}まない', '{飲|の}んだ']);
  assert.deepEqual(v('{泳|およ}ぐ', 'v1'), ['{泳|およ}ぎます', '{泳|およ}いで', '{泳|およ}がない', '{泳|およ}いだ']);
  assert.deepEqual(v('ある', 'v1'), ['あります', 'あって', 'ない', 'あった']);
  assert.deepEqual(v('{食|た}べる', 'v2'), ['{食|た}べます', '{食|た}べて', '{食|た}べない', '{食|た}べた']);
  assert.deepEqual(v('{来|く}る', 'v3'), ['{来|き}ます', '{来|き}て', '{来|こ}ない', '{来|き}た']);
  assert.deepEqual(v('{勉強|べんきょう}する', 'v3'), ['{勉強|べんきょう}します', '{勉強|べんきょう}して', '{勉強|べんきょう}しない', '{勉強|べんきょう}した']);
  assert.deepEqual(v('いい', 'i'), ['よくない', 'よかった', 'よくなかった', 'よくて']);
  assert.deepEqual(v('{高|たか}い', 'i'), ['{高|たか}くない', '{高|たか}かった', '{高|たか}くなかった', '{高|たか}くて']);
});

test('kiểm tra câu: chữ Hán thiếu cách đọc, trợ từ dính liền', () => {
  assert.deepEqual(checkJaText('{私|わたし} は {学生|がくせい} です。'), []);
  assert.equal(checkJaText('私 は 学生 です。').length, 1);
  assert.equal(checkJaText('{電話|でんわ}を かけます。').length, 1);
  assert.equal(checkJaText('{私|わたし}は {学生|がくせい} です。').length, 1);
  assert.deepEqual(checkJaText('こんにちは。'), []);
});
