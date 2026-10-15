# زملاء Git

لعبة متصفح مجانية تتعلم فيها git وطريقة شغل الفرق، وأنت داخل فريق افتراضي: مدير وزملاء يتحكم فيهم الكمبيوتر، ومشروع حقيقي تشتغلون عليه سوا.

مصممة للمبرمج اللي يشتغل لحاله: يعرف `add` و`commit` و`push`، بس ما جرب conflict مع زميل، ولا code review، ولا hotfix وهو في نص شغل.

_A free browser game that teaches git and teamwork, in Arabic or English. [Read in English](#english)_

## وش فيها

- **تيرمينال يشتغل مثل git الحقيقي:** نفس الأوامر ونفس الرسائل، مع تلميحات لما تغلط.
- **بالعربي أو بالإنجليزي:** تختار لغة الواجهة، والفريق يكلمك بها.
- **فريق افتراضي:** أبو فهد المدير، خالد المراجع الصارم، سارة اللي تدمج قبلك، وغيرهم. يتفاعلون مع اللي تسويه.
- **رتب وظيفية بدل أرقام:** متدرب ← Junior ← Senior ← مدير فريق، في 16 مستوى.
- **سمعة ونجوم:** الغلط ما يوقف اللعبة، بس الفريق يتذكره.
- **بدون حساب وبدون سيرفر:** كل شي في متصفحك، والتقدم محفوظ عندك.

الجاهز الحين: رتبة المتدرب كاملة (3 مستويات). خريطة كل المستويات في [docs/design.md](docs/design.md).

## شغّلها عندك

تحتاج Node.js 22.12 أو أحدث.

```bash
npm install
npm run dev
```

وافتح http://localhost:5173

```bash
npm run check   # فحص الأنواع والاختبارات
npm run build   # نسخة للنشر في dist/
```

## ساهم بمستوى

كل مستوى ملف واحد في `src/levels/`، وله حل مكتوب تختبره الاختبارات تلقائياً. التفاصيل في [CLAUDE.md](CLAUDE.md)، والسيناريوهات في [docs/design.md](docs/design.md).

## النشر

عند كل push على `main`، الـ workflow في `.github/workflows/deploy.yml` يبني اللعبة وينشرها على GitHub Pages. فعّلها مرة وحدة من إعدادات الـ repo: **Settings ← Pages ← Source: GitHub Actions**.

---

## English

A free browser game that teaches git and teamwork. You join a virtual team: a manager and teammates played by the computer, and a real project you all work on.

It's made for developers who have only worked alone: you know `add`, `commit` and `push`, but you've never had a conflict with a teammate, a code review, or a hotfix in the middle of your own work.

- **A terminal that behaves like real git:** the same commands and the same messages, with coaching when you slip.
- **Arabic or English:** you pick the interface language, and the team talks to you in it.
- **A virtual team:** Abu Fahd the manager, Khalid the strict reviewer, Sara who merges before you, and more. They react to what you do.
- **Job ranks instead of numbers:** Intern → Junior → Senior → Team Lead, over 16 levels.
- **Reputation and stars:** a mistake doesn't end the game, but the team remembers it.
- **No account, no server:** everything runs in your browser, and your progress stays there.

Ready now: the whole Intern rank (3 levels). The map of all levels is in [docs/design.md](docs/design.md) (in Arabic).

### Run it locally

You need Node.js 22.12 or newer.

```bash
npm install
npm run dev     # then open http://localhost:5173
npm run check   # types and tests
npm run build   # a deployable copy in dist/
```

### Add a level

Each level is one file in `src/levels/`, with a scripted solution that the tests play automatically. The details are in [CLAUDE.md](CLAUDE.md), and the scenarios in [docs/design.md](docs/design.md).

### Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the game and publishes it to GitHub Pages. Turn it on once in the repo: **Settings → Pages → Source: GitHub Actions**.
