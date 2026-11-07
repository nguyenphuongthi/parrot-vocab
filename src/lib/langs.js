// Ba ngôn ngữ và các trang của từng ngôn ngữ (đường dẫn dạng #/<ngôn ngữ>/<trang>).
export const LANGS = {
  en: {
    name: 'Tiếng Anh',
    native: 'English',
    glyph: 'A',
    unit: 'từ',
    tabs: [
      ['words', 'Kho từ'],
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
      ['review', 'Flashcard'],
    ],
  },
};
