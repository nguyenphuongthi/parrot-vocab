// Chuẩn hoá để tìm kiếm: bỏ dấu (tiếng Việt, pinyin), chữ thường, đ -> d.
export function fold(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ü/g, 'u');
}
