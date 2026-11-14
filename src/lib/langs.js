// Ba ngôn ngữ và các trang của từng ngôn ngữ (đường dẫn dạng #/<ngôn ngữ>/<trang>).
export const LANGS = {
  en: {
    name: 'Tiếng Anh',
    native: 'English',
    glyph: 'A',
    unit: 'từ',
    tabs: [
      ['words', 'Kho từ'],
      ['grammar', 'Ngữ pháp'],
      ['review', 'Flashcard'],
    ],
  },
  zh: {
    name: 'Tiếng Trung',
    native: '汉语',
    glyph: '汉',
    unit: 'từ HSK',
    tabs: [
      ['vocab', 'Từ vựng HSK'],
      ['grammar4', 'Ngữ pháp HSK 4'],
      ['grammar5', 'Ngữ pháp HSK 5'],
      ['review', 'Flashcard'],
    ],
  },
  ko: {
    name: 'Tiếng Hàn',
    native: '한국어',
    glyph: '한',
    unit: 'từ & câu',
    tabs: [
      ['alphabet', 'Bảng chữ cái'],
      ['words', 'Từ vựng'],
      ['phrases', 'Giao tiếp'],
      ['grammar1', 'Ngữ pháp TOPIK 1'],
      ['grammar2', 'Ngữ pháp TOPIK 2'],
      ['review', 'Flashcard'],
    ],
  },
};

// Khoá trong bảng items là điểm ngữ pháp? ("zh:g4-1-2", "en:g:present-simple", "ko:g:ieyo")
// Điểm ngữ pháp không vào flashcard và không tính vào số từ đã thuộc.
export const isGrammarKey = (key) => key.charAt(3) === 'g';
