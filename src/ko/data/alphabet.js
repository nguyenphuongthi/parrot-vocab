// Bảng chữ cái Hangul và quy tắc phát âm cơ bản.
// Tham khảo: 표준 발음법 (Quy tắc phát âm chuẩn – 표준어 규정 제2부, 국립국어원),
// 국어의 로마자 표기법 (Romanization chuẩn, 국립국어원 2000), giáo trình 세종한국어 1 (King Sejong Institute).
// Phần "gần giống tiếng Việt" chỉ là gợi ý để bắt đầu – nên nghe giọng đọc mẫu và bắt chước.

export const INTRO = [
  'Hangul (한글) do vua Sejong cho ban hành năm 1446. Mỗi chữ là một ký tự ghép âm (자모 – jamo): phụ âm và nguyên âm được xếp vào một ô vuông thành một âm tiết.',
  'Âm tiết luôn bắt đầu bằng một phụ âm. Nếu âm tiết mở đầu bằng nguyên âm thì dùng ㅇ câm làm "chỗ giữ chỗ": 아 = ㅇ + ㅏ (đọc "a").',
  'Nguyên âm đứng (ㅏ ㅓ ㅣ…) nằm bên phải phụ âm: 가, 너, 이. Nguyên âm nằm ngang (ㅗ ㅜ ㅡ…) nằm bên dưới: 고, 누, 그. Phụ âm cuối (받침 – patchim) luôn nằm ở đáy: 각, 산, 곰.',
];

// [chữ, phiên âm Latin, gần giống tiếng Việt, ví dụ, nghĩa ví dụ]
export const BASIC_VOWELS = [
  ['ㅏ', 'a', 'a', '아이', 'đứa trẻ'],
  ['ㅑ', 'ya', 'ia (ya)', '야구', 'bóng chày'],
  ['ㅓ', 'eo', 'ơ (miệng mở rộng hơn)', '어머니', 'mẹ'],
  ['ㅕ', 'yeo', 'yơ', '여자', 'phụ nữ'],
  ['ㅗ', 'o', 'ô (tròn môi)', '오이', 'dưa chuột'],
  ['ㅛ', 'yo', 'yô', '요리', 'nấu ăn'],
  ['ㅜ', 'u', 'u', '우유', 'sữa'],
  ['ㅠ', 'yu', 'yu', '유리', 'kính, thuỷ tinh'],
  ['ㅡ', 'eu', 'ư', '그림', 'bức tranh'],
  ['ㅣ', 'i', 'i', '이름', 'tên'],
];

export const COMPOUND_VOWELS = [
  ['ㅐ', 'ae', 'e (miệng mở)', '개', 'con chó'],
  ['ㅒ', 'yae', 'ye', '얘기', 'câu chuyện'],
  ['ㅔ', 'e', 'ê', '네', 'vâng'],
  ['ㅖ', 'ye', 'yê', '시계', 'đồng hồ'],
  ['ㅘ', 'wa', 'oa', '사과', 'quả táo'],
  ['ㅙ', 'wae', 'oe', '왜', 'tại sao'],
  ['ㅚ', 'oe', 'uê', '회사', 'công ty'],
  ['ㅝ', 'wo', 'uơ', '뭐', 'cái gì'],
  ['ㅞ', 'we', 'uê', '웨이터', 'bồi bàn'],
  ['ㅟ', 'wi', 'uy', '귀', 'cái tai'],
  ['ㅢ', 'ui', 'ưi', '의사', 'bác sĩ'],
];

export const VOWEL_NOTES = [
  'ㅐ và ㅔ ngày nay gần như đọc giống nhau (khoảng giữa "e" và "ê"); ㅙ, ㅚ, ㅞ cũng đọc gần như nhau (gần "uê").',
  'ㅢ: đứng đầu từ đọc "ưi" (의사); sau phụ âm đọc "i" (희망 [히망]); làm trợ từ sở hữu 의 thường đọc "ê".',
  'ㅓ và ㅗ dễ nhầm: ㅓ mở miệng, không tròn môi ("ơ" rộng); ㅗ tròn môi ("ô").',
];

// [chữ, tên chữ, phiên âm đầu / cuối, gần giống tiếng Việt, ví dụ, nghĩa]
export const BASIC_CONSONANTS = [
  ['ㄱ', '기역', 'g / k', 'đầu từ gần "c" nhẹ; giữa hai nguyên âm gần "g"', '가방', 'cái cặp'],
  ['ㄴ', '니은', 'n', 'n', '나라', 'đất nước'],
  ['ㄷ', '디귿', 'd / t', 'đầu từ gần "t" nhẹ; giữa hai nguyên âm gần "đ"', '다리', 'cái chân'],
  ['ㄹ', '리을', 'r / l', 'đầu âm tiết: lưỡi búng nhẹ, giữa "r" và "l"; cuối âm tiết: "l"', '라면', 'mì gói'],
  ['ㅁ', '미음', 'm', 'm', '머리', 'cái đầu'],
  ['ㅂ', '비읍', 'b / p', 'đầu từ gần "p" nhẹ; giữa hai nguyên âm gần "b"', '바다', 'biển'],
  ['ㅅ', '시옷', 's / t', '"x"; trước ㅣ, ㅑ, ㅕ… gần "sh" tiếng Anh', '사람', 'người'],
  ['ㅇ', '이응', '— / ng', 'đầu âm tiết: câm; cuối âm tiết: "ng"', '아기', 'em bé'],
  ['ㅈ', '지읒', 'j / t', '"ch" nhẹ, không bật hơi', '자리', 'chỗ ngồi'],
  ['ㅊ', '치읓', 'ch / t', '"ch" bật hơi mạnh', '차', 'xe, trà'],
  ['ㅋ', '키읔', 'k', '"kh" – "c" bật hơi', '커피', 'cà phê'],
  ['ㅌ', '티읕', 't', '"th" tiếng Việt (bật hơi)', '토마토', 'cà chua'],
  ['ㅍ', '피읖', 'p', '"p" bật hơi (như "p" tiếng Anh)', '포도', 'nho'],
  ['ㅎ', '히읗', 'h / t', 'h', '하늘', 'bầu trời'],
];

export const TENSE_CONSONANTS = [
  ['ㄲ', '쌍기역', 'kk / k', '"c" căng, gọn, không bật hơi', '까치', 'chim ác là'],
  ['ㄸ', '쌍디귿', 'tt', '"t" tiếng Việt, căng', '딸기', 'dâu tây'],
  ['ㅃ', '쌍비읍', 'pp', '"p" căng, mím môi chặt', '빵', 'bánh mì'],
  ['ㅆ', '쌍시옷', 'ss / t', '"x" căng, mạnh', '쌀', 'gạo'],
  ['ㅉ', '쌍지읒', 'jj', '"ch" căng', '짜다', 'mặn'],
];

// Ba dãy phụ âm: thường – bật hơi – căng (điểm khó nhất với người Việt)
export const THREE_WAY = [
  ['가', '카', '까'],
  ['다', '타', '따'],
  ['바', '파', '빠'],
  ['자', '차', '짜'],
  ['사', '', '싸'],
];

export const THREE_WAY_NOTE =
  'Thường (ㄱ ㄷ ㅂ ㅈ ㅅ): hơi thoát ra nhẹ. Bật hơi (ㅋ ㅌ ㅍ ㅊ): đặt tờ giấy trước miệng sẽ thấy giấy lay mạnh. Căng (ㄲ ㄸ ㅃ ㅉ ㅆ): cổ họng căng, không bật hơi, giọng hơi cao lên.';

// Patchim: mọi phụ âm cuối chỉ đọc thành 7 âm
export const BATCHIM = [
  ['ㄱ', 'k', 'ㄱ ㄲ ㅋ ㄳ ㄺ', ['국', '밖', '부엌', '닭'], 'như "c" trong "các" – không bật ra'],
  ['ㄴ', 'n', 'ㄴ ㄵ ㄶ', ['산', '앉다', '많다'], 'như "n" trong "an"'],
  ['ㄷ', 't', 'ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ ㅎ', ['곧', '옷', '낮', '꽃', '밭'], 'như "t" trong "mát"'],
  ['ㄹ', 'l', 'ㄹ ㄼ ㄽ ㄾ ㅀ', ['물', '여덟', '싫다'], '"l", đầu lưỡi chạm lợi trên và giữ lại'],
  ['ㅁ', 'm', 'ㅁ ㄻ', ['밤', '삶'], 'như "m" trong "làm"'],
  ['ㅂ', 'p', 'ㅂ ㅍ ㅄ ㄿ', ['집', '앞', '값'], 'như "p" trong "đáp"'],
  ['ㅇ', 'ng', 'ㅇ', ['강', '방'], 'như "ng" trong "càng"'],
];

export const BATCHIM_NOTE =
  'Patchim đôi (ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ): thường đọc phụ âm đầu (값 [갑], 앉다 [안따]); riêng ㄺ ㄻ (ㄿ) đọc phụ âm sau (닭 [닥], 삶 [삼]). Khi âm tiết sau bắt đầu bằng nguyên âm thì phụ âm thứ hai được nối sang (닭이 [달기]).';

// Quy tắc biến âm: [tên, tên Hàn, giải thích, ví dụ (cách viết)]
export const RULES = [
  ['Nối âm', '연음', 'Patchim đứng trước âm tiết bắt đầu bằng ㅇ thì chuyển sang làm phụ âm đầu của âm tiết đó.', ['한국어', '음악', '읽어요', '있어요']],
  ['Mũi hoá', '비음화', 'Patchim [ㄱ ㄷ ㅂ] đứng trước ㄴ, ㅁ đọc thành [ㅇ ㄴ ㅁ].', ['감사합니다', '한국말', '끝나다', '국물']],
  ['ㄹ hoá', '유음화', 'ㄴ gặp ㄹ (hoặc ㄹ gặp ㄴ) đều đọc thành [ㄹㄹ].', ['신라', '설날', '연락', '일년']],
  ['ㄹ thành ㄴ', 'ㄹ의 비음화', 'ㄹ đứng sau patchim ㅁ, ㅇ (và ㄱ, ㅂ) đọc thành [ㄴ].', ['종로', '정류장', '음료수', '심리']],
  ['Bật hơi', '격음화', 'ㅎ gặp ㄱ ㄷ ㅂ ㅈ (đứng trước hoặc sau) tạo thành [ㅋ ㅌ ㅍ ㅊ].', ['축하', '좋다', '입학', '어떻게']],
  ['Vòm hoá', '구개음화', 'Patchim ㄷ, ㅌ gặp 이 đọc thành [지], [치].', ['같이', '해돋이', '닫히다']],
  ['Căng hoá', '경음화', 'Sau patchim [ㄱ ㄷ ㅂ], phụ âm ㄱ ㄷ ㅂ ㅅ ㅈ đọc căng thành [ㄲ ㄸ ㅃ ㅆ ㅉ]. Phiên âm Latin không ghi căng hoá.', ['학교', '식당', '잡지', '숙제']],
  ['Rơi ㅎ', 'ㅎ 탈락', 'Patchim ㅎ (ㄶ, ㅀ) đứng trước nguyên âm thì ㅎ không đọc.', ['좋아요', '많이', '괜찮아요', '싫어요']],
];
