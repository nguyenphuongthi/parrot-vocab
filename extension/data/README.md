# Dữ liệu cấp độ CEFR

Hai file JSON trong thư mục này được tạo bằng `node scripts/build-cefr.js` từ
[Open Language Profiles – olp-en-cefrj](https://github.com/openlanguageprofiles/olp-en-cefrj).
Định dạng: `{ "từ viết thường": { "<loại từ>": "B1", ... } }`, loại từ: `n`, `v`, `adj`, `adv`, `prep`, `conj`,
`pron`, `interj`, `det`, `x` (khác, vd. số đếm). Các cách viết như `adviser/advisor` được tách thành từng từ.

## `cefr-j.json` – A1 đến B2

Chuyển đổi từ `cefrj-vocabulary-profile-1.5.csv`.

> The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.
> Retrieved from <http://www.cefr-j.org/download.html>.

Bản quyền thuộc Tono Laboratory, Tokyo University of Foreign Studies (TUFS). Được dùng miễn phí cho mục đích
nghiên cứu và thương mại với điều kiện ghi nguồn như trên. CEFR-J và Open Language Profiles không chịu trách
nhiệm về độ chính xác của dữ liệu.

## `cefr-c1c2.json` – C1 và C2

Chuyển đổi từ `octanove-vocabulary-profile-c1c2-1.0.csv` – Octanove Vocabulary Profile C1/C2 1.0,
tạo bởi [Octanove Labs](https://www.octanove.com/).

File này (bản chuyển đổi) được phát hành theo cùng giấy phép với dữ liệu gốc:
[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
Thay đổi so với bản gốc: chỉ giữ cột từ, loại từ, cấp độ; viết thường; tách các cách viết; đổi sang JSON.
