// Ví dụ lấy từ văn bản "국어의 로마자 표기법" (국립국어원) và 표준 발음법.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, decompose, pronounce, pronunciationHint, romanize } from '../src/features/ko/romanize.js';

const cases = {
  // Mũi hoá, ㄹ hoá (제3장 제1항)
  백마: 'baengma', 종로: 'jongno', 왕십리: 'wangsimni', 별내: 'byeollae', 신라: 'silla',
  // Vòm hoá, bật hơi
  해돋이: 'haedoji', 같이: 'gachi', 굳히다: 'guchida', 좋고: 'joko', 놓다: 'nota', 잡혀: 'japyeo', 낳지: 'nachi',
  // Danh từ ㄱ ㅂ + ㅎ giữ h
  묵호: 'mukho', 집현전: 'jiphyeonjeon',
  // Không ghi căng hoá
  압구정: 'apgujeong', 낙동강: 'nakdonggang', 합덕: 'hapdeok',
  // Patchim, nối âm
  구미: 'gumi', 백암: 'baegam', 옥천: 'okcheon', 호법: 'hobeop', 월곶: 'wolgot', 벚꽃: 'beotkkot', 한밭: 'hanbat',
  구리: 'guri', 설악: 'seorak', 칠곡: 'chilgok', 임실: 'imsil', 울릉: 'ulleung', 대관령: 'daegwallyeong',
  // Câu thường gặp
  안녕하세요: 'annyeonghaseyo', 감사합니다: 'gamsahamnida', 괜찮아요: 'gwaenchanayo', 맛있어요: 'masisseoyo',
  없어요: 'eopseoyo', 읽어요: 'ilgeoyo', 좋아요: 'joayo', 많이: 'mani', 몰라요: 'mollayo', 실례합니다: 'sillyehamnida',
  한국어: 'hangugeo', 학교: 'hakgyo', 축하합니다: 'chukhahamnida', 못해요: 'motaeyo', 앉으세요: 'anjeuseyo',
  '만나서 반갑습니다.': 'mannaseo bangapseumnida.',
};

for (const [ko, rr] of Object.entries(cases)) {
  test(`romanize ${ko}`, () => assert.equal(romanize(ko), rr));
}

test('pronounce: biến âm và căng hoá', () => {
  assert.equal(pronounce('학교'), '학꾜');
  assert.equal(pronounce('입학'), '이팍');
  assert.equal(pronounce('감사합니다'), '감사함니다');
  assert.equal(pronounce('없어요'), '업써요');
  assert.equal(pronounce('읽고'), '일꼬');
  assert.equal(pronounce('앉다'), '안따');
  assert.equal(pronounce('희망'), '히망');
  assert.equal(pronounce('설날'), '설랄');
});

test('pronunciationHint chỉ hiện khi khác cách viết', () => {
  assert.equal(pronunciationHint('나라'), '');
  assert.equal(pronunciationHint('한국어'), '한구거');
  assert.equal(pronunciationHint('꽃잎', '꼰닙'), '꼰닙');
});

test('decompose / compose', () => {
  assert.deepEqual(decompose('닭'), { i: 'ㄷ', v: 'ㅏ', f: 'ㄺ' });
  assert.equal(compose({ i: 'ㅎ', v: 'ㅏ', f: 'ㄴ' }), '한');
});

test('pronounce: phụ âm vừa nối âm không bị căng hoá', () => {
  assert.equal(pronounce('앉아도'), '안자도');
  assert.equal(pronounce('읽어요'), '일거요');
  assert.equal(pronounce('앉고'), '안꼬');
});
