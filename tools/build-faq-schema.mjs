// index.html の画面に出ている FAQ から FAQPage の構造化データを作る
// 2026-09-09 太郎  使い方: node tools/build-faq-schema.mjs
//
// ★必ず「画面に出ている文言」から作る。CHECKLIST_KOKAI D分野の
//   「JSON-LDが可視コンテンツと一致（見えないFAQPage禁止）」を、仕組みで守るため。
//   FAQを増やしたり直したら、このコマンドを流し直せば構造化データも追従する。
// ★「要確認」の印が付いた部分は答えから外す。社内向けの印を客とAIに見せない。
import fs from 'fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const F = ROOT + 'index.html';
let s = fs.readFileSync(F, 'utf8');

const strip = (h) => h
  .replace(/<span class="todo">[\s\S]*?<\/span>/g, '')   // 社内向けの「要確認」を外す
  .replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const items = [];
for (const m of s.matchAll(/<details[^>]*>([\s\S]*?)<\/details>/g)) {
  const body = m[1];
  const q = /<summary>([\s\S]*?)<\/summary>/.exec(body);
  if (!q) continue;
  const question = strip(q[1]);
  const answer = strip(body.replace(/<summary>[\s\S]*?<\/summary>/, ''));
  if (!question || answer.length < 10) { console.log('  とばした（答えが短い）:', question); continue; }
  items.push({ question, answer });
}
if (!items.length) { console.error('中止: 画面にFAQが見つからない'); process.exit(1); }

const schema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://pazoo.co.jp/#faq',
  mainEntity: items.map((it) => ({
    '@type': 'Question',
    name: it.question,
    acceptedAnswer: { '@type': 'Answer', text: it.answer },
  })),
};

const MARK_A = '<!-- FAQPage：画面のFAQから自動生成（tools/build-faq-schema.mjs）。手で書かない -->';
const MARK_B = '<!-- /FAQPage -->';
const block = `${MARK_A}\n<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>\n${MARK_B}`;

if (s.includes(MARK_A)) {
  s = s.replace(new RegExp(MARK_A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + MARK_B.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), block);
  console.log('既存のFAQPageを更新した');
} else {
  s = s.replace('</head>', block + '\n</head>');
  console.log('FAQPageを新しく入れた');
}
fs.writeFileSync(F, s);
console.log(`FAQ ${items.length}問を構造化データにした`);
items.forEach((it, i) => console.log(`  ${i + 1}. ${it.question}`));
