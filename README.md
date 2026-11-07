# Languages · English · 汉语 · 한국어

A personal vocabulary app for three languages, built for Vietnamese learners. Each language gets the approach that suits it best:

| Language | Approach |
|---|---|
| 🇬🇧 **English** | Pick up words while reading the web with a **Chrome extension**, then review them in the app |
| 🇨🇳 **Chinese** | Learn from the **HSK syllabus and the *标准教程 HSK 4 / HSK 5* textbooks** |
| 🇰🇷 **Korean** | Start from scratch: **Hangul**, beginner vocabulary and everyday conversation |

All three share one account, one spaced-repetition system and one Supabase database, so progress syncs across the web app, phones and the extension.

---

## Shared features

- **Three mastery levels** for every word, sentence and grammar point: ○ not learned · ◐ vaguely remember · ● learned.
- **Flashcards with spaced repetition**: cards you forget come back tomorrow, cards you know move out to 7 days and then ×2.5 each time (up to 180 days). Five review modes: word → meaning, meaning → word, listening, typing, multiple choice.
- **Daily goal and streak** 🔥 counted across all three languages.
- **Statistics**: cards per level, reviews over the last 30 days, and a daily chart of marked items, filterable by language.
- **Offline-first**: data is stored in the browser (IndexedDB) and synced to Supabase in the background. The app installs on a phone like a native app (PWA).
- **Pronunciation**: opening a card reads it aloud (real recordings for English when available, the device's built-in voices for Chinese and Korean).
- **Animated scene**: the top bar is a small landscape with a parrot mascot that flies down, waves (Hi! / 你好! / 안녕!) and goes back to its tree. It cycles through day, sunset, night, rain (the parrot holds a leaf umbrella) and snow, with a butterfly, a sleeping cat, a frog or a snowman. All animation turns off when the system's *reduce motion* setting is on.
- **The parrot reacts to your learning**: it cheers when you mark a card ● learned, scratches its head when you forget one, and flies a loop with full-screen confetti when you hit the daily goal. Tap it and it says one of the words you are learning, out loud.
- **The tree grows with you**: its crown gets bigger as your learned-word count rises, a blossom opens every 20 words and a fruit appears every 50.
- **Badges**: 15 achievements (e.g. *100 HSK 1 words*, *Hangul alphabet*, *7-day streak*, *Polyglot*) that flip open with a toast when unlocked. The streak flame grows with every day, with 7- and 30-day milestones.
- **Session summary**: at the end of a flashcard round the parrot holds up a sign (*+12 learned*), counts tick up and the three level bars grow.
- **On phones**: pull down at the top of the page and the parrot drops in to sync.

---

## 🇬🇧 English: extension + review

English words come from what you actually read. The **Vocab English Lens** Chrome extension ([`extension/`](extension)) lets you look up and save words on any web page or YouTube video, and the web app turns them into flashcards. Both use the same `words` table, so a word saved in the extension shows up in the app, and progress made in the app syncs back to the extension.

**In the extension, while reading**
- Select a word or a short phrase to see its Vietnamese meaning, meanings by part of speech, **US / UK** pronunciation and **CEFR** level.
- Save it together with the sentence you were reading (up to 5 context sentences per word).
- Suggests the base form (*exaggerating* → *exaggerate*) and tells you if it is already saved.
- **Detailed explanation**: translated sentence, English and Vietnamese definitions, examples and synonyms.
- Saved words are **underlined on every page** you visit.
- **YouTube**: click a word in the subtitles and the video pauses; the saved link reopens at the exact timestamp.
- The extension icon shows how many words are due today.

**In the web app**
- **Word bank**: search, filter by part of speech, CEFR level (A1–C2) and mastery level; each word shows its context sentences with links back to the source.
- **Flashcards**: English → Vietnamese, Vietnamese → English, listening, spelling (any form you have met counts), and multiple choice with distractors of the same part of speech.

---

## 🇨🇳 中文：跟着 HSK 教材学

中文部分以 **HSK 考试大纲（HSK 2.0）** 和 **《标准教程 HSK 4》《标准教程 HSK 5》** 两本教材为基础。

**HSK 词汇**
- HSK 1–6 级共 **4,998 个词**，按级别分组。
- 每个词都有汉字、拼音、汉越音、越南语和英语释义，以及例句。
- 点击词语时，格子会翻转显示拼音，并自动朗读。
- 例句默认只显示汉字，先自己读；点击后才显示逐字拼音、越南语 / 英语翻译和所用的语法点。点击朗读时，例句会逐字高亮（跟读）。
- 可以用汉字、拼音（不带声调也行）、汉越音或释义搜索。

**HSK 4 / HSK 5 语法**
- 按教材编排：HSK 4 共 20 课，HSK 5 共 36 课。
- 每课包括 **课文**（带拼音和翻译）、**生词**、**注释**（语法点讲解、例句、练一练、近义词辨析）、**词语搭配**（HSK 5）、**练习**（附答案）和 **扩展**。
- 每个语法点也可以标记掌握程度 ○ ◐ ●。

**闪卡**
- 从"学新词"开始，按 HSK 级别依次学习，学过的词会按复习计划自动出现。
- 复习方式：汉字 → 释义、释义 → 汉字、听音辨词、**输入拼音**（不需要声调，例如 `nihao`）、选择题。

---

## 🇰🇷 한국어: 한글부터 차근차근

한국어 부분은 **완전 초보자**를 위해 만들었습니다. 한글을 읽는 법부터 시작해서 기초 어휘와 일상 회화까지 이어집니다.

**한글 (자모)**
- 기본 모음 10개, 이중 모음 11개, 기본 자음 14개, 된소리 5개. 글자마다 로마자 표기, 베트남어로 비슷한 발음, 예시 단어가 있고 **클릭하면 소리를 들으면서 획순대로 한 획씩 그려지는 모습을 볼 수 있습니다**.
- 베트남 사람이 가장 어려워하는 **평음 / 격음 / 경음** (가 카 까, 다 타 따…)을 나란히 들으며 비교할 수 있습니다.
- **받침 7개 대표음**과 **음운 규칙**: 연음, 비음화, 유음화, 격음화, 구개음화, 경음화, ㅎ 탈락.
- **글자 만들기**: 초성 + 중성 + 받침을 골라 글자를 만들면 그 글자(예: 한)가 획순대로 그려집니다. 어떤 단어나 문장이든 입력하면 실제 발음과 로마자 표기를 보여 줍니다.

**어휘**
- TOPIK I 수준의 기초 어휘 **639개**, 인사·숫자·가족·음식·교통·쇼핑·날씨 등 **22개 주제**.
- 표기와 발음이 다를 때는 **실제 발음**을 보여 줍니다 (한국어 → [한구거]). 한자어는 **한월음**도 함께 표시합니다 (학교 → học hiệu).

**회화**
- **13개 상황**의 문장 **165개**: 인사, 자기소개, 식당, 쇼핑, 길 묻기, 전화, 병원, 호텔 등.
- 처음에는 한국어 문장만 보이고, 클릭하면 뜻·발음·사용 상황(존댓말 수준)이 나옵니다. 문장을 들을 때는 음절이 하나씩 강조됩니다(따라 읽기).

**발음 규칙 자동 계산**
- 로마자 표기는 **국어의 로마자 표기법**을 따르며, 발음과 로마자 표기는 `src/ko/romanize.js`의 음운 규칙으로 자동 계산됩니다. 표준 규정의 예시로 만든 테스트 50개로 검증합니다.

---

## Tech stack

React + Vite web app · Chrome extension (Manifest V3) · Supabase (Auth, Postgres with Row Level Security) · IndexedDB + service worker for offline use · Vercel hosting with routing middleware · GitHub Actions for CI and keeping the Supabase project awake.

This repository merges two earlier projects: [eng-vocab-lens](https://github.com/nguyenphuongthi/eng-vocab-lens) and [HSK-Vocab](https://github.com/nguyenphuongthi/HSK-Vocab).

## Data sources & licenses

**English**
- CEFR levels: CEFR-J Wordlist 1.5 (A1–B2, © Tono Laboratory, TUFS) and Octanove Vocabulary Profile C1/C2 (CC BY-SA 4.0). See [`public/data/en/README.md`](public/data/en/README.md).
- Meanings, pronunciation and context are looked up and saved by the extension.

**Chinese**
- Word list from the HSK 2.0 syllabus (mock.tangce.cn). Pinyin checked against CC-CEDICT (CC BY-SA 4.0); example sentence pinyin generated with [pinyin-pro](https://github.com/zh-lx/pinyin-pro).
- Grammar follows the *标准教程 HSK 4* and *HSK 5* textbooks. English translations, example sentence translations and exercise answers were written separately. Textbook PDFs are not included in the repository.

**Korean**: newly written (with AI assistance), based on:
- 국립국어원 (National Institute of Korean Language): *국어의 로마자 표기법*, *표준 발음법*, *한국어 학습용 어휘 목록*.
- The TOPIK I vocabulary list.
- The *세종한국어* textbooks (King Sejong Institute) for topics and conversation patterns.
