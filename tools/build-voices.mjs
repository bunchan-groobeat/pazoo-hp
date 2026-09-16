// data/reviews_latest.json から index.html の口コミカードを生成して差し替える
// 2026-09-09 太郎（社長「goo評価載せて」）
// 使い方: node tools/build-voices.mjs
// ★グーネットに書かれた原文をそのまま出す。文を足したり直したりしない。
// ★自社サイトに自分で aggregateRating（星の平均）を構造化データで書かない（CHECKLIST_KOKAI D分野の禁止事項）。
//   画面に出す数字は「グーネットの集計値の引用」で、出典リンクを必ず添える。
import fs from 'fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const d = JSON.parse(fs.readFileSync(ROOT + 'data/reviews_latest.json', 'utf8'));

const MAKERS = ['トヨタ', '日産', 'ホンダ', 'スズキ', 'スバル', 'マツダ', 'ダイハツ', '三菱', 'レクサス'];
function splitCar(car) {
  const m = MAKERS.find(x => car.startsWith(x));
  return m ? m + ' ' + car.slice(m.length) : car;
}
function ym(date) {
  const m = /(\d{4})年(\d{1,2})月/.exec(date || '');
  return m ? `${m[1]}年${Number(m[2])}月` : '';
}
function stars(score) {
  const full = Math.floor(score), half = score - full >= 0.4;
  let s = '';
  for (let i = 0; i < full; i++) s += '<svg class="st" aria-hidden="true"><use href="#i-star"/></svg>';
  if (half) s += '<svg class="st half" aria-hidden="true"><use href="#i-star"/></svg>';
  return s;
}
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 横に流すレール（社長 2026-09-09「Gooの評価内容は横スクロールにして自動で流して」）。
// ★継ぎ目を消すため同じ並びを2組つくる。2組目は読み上げが二重にならないよう aria-hidden。
//   全件が2周に含まれるので、カードの大小は付けない（流れる帯では大小がガタつくため）。
const card = (r) => `        <article class="vcard">
          <svg class="qmark" aria-hidden="true"><use href="#i-quote"/></svg>
          <p class="vtext">${esc(r.text)}</p>
          <div class="vmeta">
            <span class="avatar" aria-hidden="true">${esc(r.who.slice(0, 1))}</span>
            <span class="vwho"><b>${esc(r.who)}さん</b><span class="vcar"><svg class="ic" aria-hidden="true"><use href="#i-car"/></svg>${esc(splitCar(r.car))}</span></span>
            <span class="vstars" role="img" aria-label="評価${r.score}">${stars(r.score)}</span>
            <time>${ym(r.date)}</time>
          </div>
        </article>`;

const set1 = d.reviews.map(card).join('\n');
const set2 = d.reviews.map(card).join('\n').replace(/<article class="vcard">/g, '<article class="vcard" aria-hidden="true">');

const voices = `<div class="voices anime ani_slideup d1" id="voices" tabindex="0" aria-label="お客様の声（横にスクロールします）">
      <div class="vtrack" id="vtrack">
${set1}
${set2}
      </div>
    </div>`;
const note = `    <p class="note anime ani_fade d2">${d.checkedAt.slice(0, 10)} 時点でグーネットに${d.count}件。原文のまま全件を載せています。<a href="${d.source}" target="_blank" rel="noopener">グーネットの口コミページ</a>で最新をご覧いただけます。</p>`;

const f = ROOT + 'index.html';
let s = fs.readFileSync(f, 'utf8');
// 改行コードに依存しないように、.voices の開始 〜 出典の注記の開始 までを丸ごと差し替える
const a = s.indexOf('<div class="voices');
if (a < 0) { console.error('中止: .voices ブロックが見つからない'); process.exit(1); }
const noteA = s.indexOf('<p class="note anime', a);
if (noteA < 0) { console.error('中止: 出典の注記が見つからない'); process.exit(1); }
const noteB = s.indexOf('</p>', noteA) + 4;
const lastClose = s.lastIndexOf('</div>', noteA) + '</div>'.length;
if (lastClose <= a) { console.error('中止: .voices の閉じが見つからない'); process.exit(1); }
const b = lastClose;

s = s.slice(0, a) + voices + s.slice(b, noteA) + note + s.slice(noteB);
fs.writeFileSync(f, s);

const n = (s.match(/class="vcard/g) || []).length;
console.log(`口コミカード ${n} 件を index.html に反映（データ ${d.reviews.length} 件）`);
console.log(`出典: ${d.source}`);
