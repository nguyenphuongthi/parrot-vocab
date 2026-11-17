// Bảng chữ cái kana (Hiragana, Katakana) và quy tắc phát âm cơ bản.
// Tham khảo: bảng 50 âm (五十音), phiên âm Hepburn; giáo trình みんなの日本語 初級 (bảng chữ và phát âm),
// まるごと 入門 A1 (Japan Foundation). Gợi ý “gần giống tiếng Việt” chỉ để bắt đầu – nên nghe giọng đọc mẫu.
import { toKatakana } from './text.js';

export const INTRO = [
  'Tiếng Nhật dùng ba loại chữ cùng lúc: Hiragana (ひらがな) cho từ thuần Nhật và đuôi ngữ pháp, Katakana (カタカナ) cho từ mượn nước ngoài, tên nước, tên người nước ngoài, và Kanji (漢字 – chữ Hán) cho phần lớn danh từ, gốc động từ, tính từ.',
  'Mỗi chữ kana là một âm tiết (một “phách”): か = ka, し = shi. Hai bảng có cùng 46 âm cơ bản, mỗi âm có một chữ Hiragana và một chữ Katakana tương ứng.',
  'Người mới bắt đầu nên học thuộc Hiragana trước (khoảng 1–2 tuần), sau đó Katakana. Bấm vào từng chữ để nghe và xem thứ tự nét viết.',
];

// Bảng 50 âm: mỗi hàng 5 ô theo nguyên âm a-i-u-e-o ('' = ô trống)
export const GOJUON = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '', 'ゆ', '', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '', '', '', 'を'],
  ['ん', '', '', '', ''],
];

// Âm đục (゛) và bán đục (゜)
export const DAKUON = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
];

// Âm ghép (拗音): chữ hàng い + ゃ ゅ ょ viết nhỏ
export const YOON = ['き', 'し', 'ち', 'に', 'ひ', 'み', 'り', 'ぎ', 'じ', 'び', 'ぴ'].map((c) => [c + 'ゃ', c + 'ゅ', c + 'ょ']);

// Gợi ý phát âm cho những chữ dễ đọc sai
export const HINTS = {
  う: 'giữa “u” và “ư”, môi không tròn',
  え: 'gần “ê”',
  お: 'gần “ô”',
  し: '“shi” – gần “xi”, lưỡi hơi cong',
  す: '“su” – “u” rất nhẹ, nghe gần “xư”',
  ち: '“chi” – gần “chi”',
  つ: '“tsu” – bắt đầu bằng “ts”, gần “chư” nhẹ',
  ふ: '“fu” – thổi hơi nhẹ qua hai môi, giữa “ph” và “h”',
  ら: '“r” – đầu lưỡi búng nhẹ, giữa “r” và “l”',
  を: 'đọc “o”, chỉ dùng làm trợ từ',
  ん: '“n / m / ng” tuỳ âm đứng sau; đọc đủ một phách',
  ぢ: 'đọc như じ (ji), rất ít dùng',
  づ: 'đọc như ず (zu), rất ít dùng',
  じ: '“ji” – gần “gi”',
  ず: '“zu” – gần “dư”',
};

// Từ ví dụ cho mỗi chữ: [kana, từ, nghĩa]
export const EXAMPLES = {
  あ: ['あめ', 'mưa'], い: ['いぬ', 'con chó'], う: ['うみ', 'biển'], え: ['えき', 'nhà ga'], お: ['おちゃ', 'trà'],
  か: ['かさ', 'cái ô'], き: ['きって', 'tem thư'], く: ['くつ', 'giày'], け: ['けさ', 'sáng nay'], こ: ['こども', 'trẻ con'],
  さ: ['さかな', 'cá'], し: ['しお', 'muối'], す: ['すし', 'sushi'], せ: ['せんせい', 'giáo viên'], そ: ['そら', 'bầu trời'],
  た: ['たまご', 'trứng'], ち: ['ちず', 'bản đồ'], つ: ['つくえ', 'cái bàn'], て: ['てがみ', 'lá thư'], と: ['とけい', 'đồng hồ'],
  な: ['なまえ', 'tên'], に: ['にく', 'thịt'], ぬ: ['ぬいぐるみ', 'thú bông'], ね: ['ねこ', 'con mèo'], の: ['のみもの', 'đồ uống'],
  は: ['はな', 'hoa'], ひ: ['ひと', 'người'], ふ: ['ふく', 'quần áo'], へ: ['へや', 'căn phòng'], ほ: ['ほん', 'sách'],
  ま: ['まど', 'cửa sổ'], み: ['みず', 'nước'], む: ['むし', 'côn trùng'], め: ['めがね', 'kính'], も: ['もも', 'quả đào'],
  や: ['やま', 'núi'], ゆ: ['ゆき', 'tuyết'], よ: ['よる', 'buổi tối'],
  ら: ['らいねん', 'năm sau'], り: ['りんご', 'quả táo'], る: ['るす', 'vắng nhà'], れ: ['れいぞうこ', 'tủ lạnh'], ろ: ['ろうか', 'hành lang'],
  わ: ['わたし', 'tôi'], を: ['ほん を よむ', 'đọc sách (trợ từ を)'], ん: ['みかん', 'quả quýt'],
  が: ['がっこう', 'trường học'], ぎ: ['ぎんこう', 'ngân hàng'], ぐ: ['ぐあい', 'tình trạng'], げ: ['げんき', 'khoẻ'], ご: ['ごはん', 'cơm'],
  ざ: ['ざっし', 'tạp chí'], じ: ['じしょ', 'từ điển'], ず: ['みず', 'nước'], ぜ: ['ぜんぶ', 'tất cả'], ぞ: ['かぞく', 'gia đình'],
  だ: ['だいがく', 'đại học'], ぢ: ['はなぢ', 'chảy máu cam'], づ: ['つづく', 'tiếp tục'], で: ['でんわ', 'điện thoại'], ど: ['どこ', 'ở đâu'],
  ば: ['ばんごはん', 'bữa tối'], び: ['びょういん', 'bệnh viện'], ぶ: ['ぶたにく', 'thịt lợn'], べ: ['べんきょう', 'học'], ぼ: ['ぼうし', 'cái mũ'],
  ぱ: ['かんぱい', 'cạn ly'], ぴ: ['えんぴつ', 'bút chì'], ぷ: ['きっぷ', 'vé'], ぺ: ['ぺらぺら', 'trôi chảy'], ぽ: ['さんぽ', 'đi dạo'],
};

export const KATA_EXAMPLES = {
  ア: ['アイス', 'kem'], イ: ['イギリス', 'nước Anh'], ウ: ['ウイスキー', 'rượu whisky'], エ: ['エアコン', 'điều hoà'], オ: ['オレンジ', 'quả cam'],
  カ: ['カメラ', 'máy ảnh'], キ: ['キロ', 'ki-lô'], ク: ['クラス', 'lớp học'], ケ: ['ケーキ', 'bánh ngọt'], コ: ['コーヒー', 'cà phê'],
  サ: ['サッカー', 'bóng đá'], シ: ['シャツ', 'áo sơ mi'], ス: ['スーパー', 'siêu thị'], セ: ['セーター', 'áo len'], ソ: ['ソース', 'nước sốt'],
  タ: ['タクシー', 'taxi'], チ: ['チーズ', 'phô mai'], ツ: ['ツアー', 'tour du lịch'], テ: ['テレビ', 'ti vi'], ト: ['トイレ', 'nhà vệ sinh'],
  ナ: ['ナイフ', 'con dao'], ニ: ['ニュース', 'tin tức'], ヌ: ['ヌードル', 'mì sợi'], ネ: ['ネクタイ', 'cà vạt'], ノ: ['ノート', 'quyển vở'],
  ハ: ['ハンカチ', 'khăn tay'], ヒ: ['ヒーター', 'máy sưởi'], フ: ['フランス', 'nước Pháp'], ヘ: ['ヘリコプター', 'trực thăng'], ホ: ['ホテル', 'khách sạn'],
  マ: ['マスク', 'khẩu trang'], ミ: ['ミルク', 'sữa'], ム: ['ハム', 'giăm bông'], メ: ['メール', 'email'], モ: ['モデル', 'người mẫu'],
  ヤ: ['タイヤ', 'lốp xe'], ユ: ['ユニフォーム', 'đồng phục'], ヨ: ['ヨーグルト', 'sữa chua'],
  ラ: ['ラジオ', 'radio'], リ: ['リボン', 'ruy băng'], ル: ['ルール', 'luật lệ'], レ: ['レストラン', 'nhà hàng'], ロ: ['ロボット', 'người máy'],
  ワ: ['ワイン', 'rượu vang'], ン: ['パン', 'bánh mì'],
};

// Âm mở rộng chỉ có ở Katakana (viết từ mượn): [chữ, ví dụ, nghĩa]
export const EXTENDED = [
  ['ティ', 'パーティー', 'bữa tiệc'],
  ['ディ', 'ディナー', 'bữa tối (nhà hàng)'],
  ['ファ', 'ファン', 'người hâm mộ'],
  ['フィ', 'フィルム', 'phim (máy ảnh)'],
  ['フェ', 'カフェ', 'quán cà phê'],
  ['フォ', 'フォーク', 'cái nĩa'],
  ['ウィ', 'ハロウィン', 'lễ Halloween'],
  ['ウェ', 'ウェイター', 'bồi bàn'],
  ['シェ', 'シェフ', 'đầu bếp'],
  ['チェ', 'チェック', 'kiểm tra'],
  ['ジェ', 'ジェットコースター', 'tàu lượn siêu tốc'],
];

// Quy tắc phát âm: [tên, giải thích, [[từ, nghĩa], …]]
export const RULES = [
  [
    'Âm đục ゛ và bán đục ゜',
    'Thêm hai chấm ゛ (dakuten) vào hàng か さ た は → が ざ だ ば (âm đục, rung dây thanh). Thêm vòng tròn ゜ (handakuten) vào hàng は → ぱ (âm “p”).',
    [['かき', 'quả hồng'], ['かぎ', 'chìa khoá'], ['はん', 'một nửa'], ['ばん', 'buổi tối'], ['ぱん', 'bánh mì']],
  ],
  [
    'Âm ghép (ゃ ゅ ょ nhỏ)',
    'Chữ hàng い + ゃ ゅ ょ viết nhỏ thành một âm tiết: き + ゃ = きゃ (kya). Đọc liền làm một phách, không tách thành “ki-ya”.',
    [['びょういん', 'bệnh viện'], ['びよういん', 'tiệm làm tóc'], ['きょう', 'hôm nay'], ['しゃしん', 'ảnh']],
  ],
  [
    'Âm ngắt っ (つ nhỏ)',
    'っ viết nhỏ làm phụ âm sau được nhân đôi: ngừng lại một phách rồi mới đọc tiếp. Romaji ghi bằng phụ âm đôi: きって = kitte.',
    [['きて', 'hãy đến'], ['きって', 'tem thư'], ['いけん', 'ý kiến'], ['いっけん', 'một căn (nhà)'], ['ざっし', 'tạp chí']],
  ],
  [
    'Trường âm (nguyên âm dài)',
    'Nguyên âm kéo dài gấp đôi (hai phách). Hiragana: thêm あ／い／う sau chữ cùng hàng; hàng え thêm い (せんせい), hàng お thêm う (こうこう). Katakana dùng dấu “ー”. Đọc ngắn hay dài sẽ đổi nghĩa.',
    [['おばさん', 'cô, dì'], ['おばあさん', 'bà'], ['おじさん', 'chú, bác'], ['おじいさん', 'ông'], ['ゆき', 'tuyết'], ['ゆうき', 'dũng khí'], ['ビル', 'toà nhà'], ['ビール', 'bia']],
  ],
  [
    'Âm ん',
    'ん luôn đứng sau một âm khác và được đọc đủ một phách. Trước m b p đọc gần “m” (さんぽ), trước k g đọc gần “ng” (ぎんこう), các trường hợp khác gần “n”.',
    [['さんぽ', 'đi dạo'], ['ぎんこう', 'ngân hàng'], ['ほんや', 'hiệu sách'], ['こんにちは', 'xin chào']],
  ],
  [
    'Trợ từ は・へ・を',
    'Khi làm trợ từ: は đọc “wa”, へ đọc “e”, を đọc “o”. Trong từ bình thường vẫn đọc ha, he, o (はな, へや).',
    [['わたし は', 'tôi thì… (trợ từ は)'], ['がっこう へ', 'đến trường (trợ từ へ)'], ['ほん を', 'sách (trợ từ を)']],
  ],
  [
    'Âm vô thanh hoá',
    'Nguyên âm i, u kẹp giữa các phụ âm vô thanh (k s t h p) hoặc ở cuối です／ます thường đọc rất nhẹ, gần như mất: です ≈ “dés”, します ≈ “shi-más”, すき ≈ “s-ki”.',
    [['です', 'là'], ['します', 'làm'], ['すき', 'thích'], ['ちかてつ', 'tàu điện ngầm']],
  ],
  [
    'Cao độ (accent)',
    'Tiếng Nhật không có thanh điệu như tiếng Việt nhưng có cao độ (cao – thấp) giữa các phách. Một số từ chỉ khác nhau về cao độ: はし (đũa: cao–thấp) / はし (cầu: thấp–cao). Cách tốt nhất là nghe và bắt chước.',
    [['はし', 'đũa / cầu'], ['あめ', 'mưa / kẹo']],
  ],
];

export const kata = toKatakana;
